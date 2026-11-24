using AgainBuy.Api.Assistant;
using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

/// <summary>
/// The AI shopping assistant, with saved conversations. Every conversation
/// belongs to the signed-in user; anyone else's answers 404. A question and
/// its answer are saved together, and only once the answer has been produced.
/// </summary>
[ApiController]
[Route("api/assistant/conversations")]
[Authorize]
public class AssistantController(AppDbContext db, AssistantResponder responder) : ControllerBase
{
    // Long enough for a real chat; past this, start a new one (keeps History readable).
    public const int MaxMessagesPerConversation = 200;

    private const int TitleLength = 60;
    private const int PreviewLength = 120;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AssistantConversationSummaryDto>>> List(CancellationToken cancellationToken)
    {
        var userId = User.UserId()!;
        // Newest first; sorted before projecting so it runs in the database.
        return await Summaries(db.AssistantConversations.Where(conversation => conversation.UserId == userId).OrderByDescending(conversation => conversation.UpdatedAt).Take(100))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AssistantConversationDto>> Get(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId()!;
        var summary = await Summaries(db.AssistantConversations.Where(conversation => conversation.Id == id && conversation.UserId == userId)).SingleOrDefaultAsync(cancellationToken);
        if (summary is null) return NotFound();
        var messages = await db.AssistantMessages.AsNoTracking()
            .Where(message => message.ConversationId == id)
            .OrderBy(message => message.Id)
            .ToListAsync(cancellationToken);
        var cards = await Cards(messages.SelectMany(message => message.ProductIds), userId, cancellationToken);
        return new AssistantConversationDto(summary, messages.Select(message => ToDto(message, cards)).ToList());
    }

    /// <summary>Starts a conversation with its first question and returns the answer.</summary>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Assistant)]
    public async Task<ActionResult<AssistantExchangeDto>> Start(StartAssistantConversationRequest request, CancellationToken cancellationToken)
    {
        var userId = User.UserId()!;
        var question = request.Message.Trim();
        if (question.Length == 0) return Invalid("Ask a question first.");
        if (!responder.IsConfigured) return NotSetUp();

        Product? listing = null;
        if (!string.IsNullOrWhiteSpace(request.ProductId))
        {
            listing = await VisibleListing(request.ProductId, userId, cancellationToken);
            if (listing is null) return NotFound();
        }

        var conversation = new AssistantConversation { Id = Ids.New("AIC-"), UserId = userId, Title = Title(question), ProductId = listing?.Id };
        return await Answer(conversation, [], question, listing, isNew: true, cancellationToken);
    }

    /// <summary>Asks the next question; the answer uses this conversation's saved history.</summary>
    [HttpPost("{id}/messages")]
    [EnableRateLimiting(RateLimitPolicies.Assistant)]
    public async Task<ActionResult<AssistantExchangeDto>> Ask(string id, AssistantQuestionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.UserId()!;
        var conversation = await db.AssistantConversations.SingleOrDefaultAsync(candidate => candidate.Id == id && candidate.UserId == userId, cancellationToken);
        if (conversation is null) return NotFound();
        var question = request.Message.Trim();
        if (question.Length == 0) return Invalid("Ask a question first.");
        if (!responder.IsConfigured) return NotSetUp();

        var count = await db.AssistantMessages.CountAsync(message => message.ConversationId == id, cancellationToken);
        if (count + 2 > MaxMessagesPerConversation)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This chat is full. Start a new chat to keep asking.");

        // The latest turns, oldest first, for context.
        var history = await db.AssistantMessages.AsNoTracking()
            .Where(message => message.ConversationId == id)
            .OrderByDescending(message => message.Id)
            .Take(AssistantResponder.HistoryTurns)
            .OrderBy(message => message.Id)
            .Select(message => new ChatTurn(message.Role, message.Content, null, null))
            .ToListAsync(cancellationToken);
        // The listing may have been sold or hidden since; then answer without it.
        var listing = conversation.ProductId is null ? null : await VisibleListing(conversation.ProductId, userId, cancellationToken);
        return await Answer(conversation, history, question, listing, isNew: false, cancellationToken);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId()!;
        var deleted = await db.AssistantConversations.Where(conversation => conversation.Id == id && conversation.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0 ? NotFound() : NoContent();
    }

    private async Task<ActionResult<AssistantExchangeDto>> Answer(AssistantConversation conversation, List<ChatTurn> history, string question, Product? listing, bool isNew, CancellationToken cancellationToken)
    {
        var userId = conversation.UserId;
        AssistantResponder.Answer answer;
        try
        {
            answer = await responder.Respond(userId, listing, [.. history, new ChatTurn("user", question)], cancellationToken);
        }
        catch (ChatModelBusyException busy)
        {
            Response.Headers.RetryAfter = "30";
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: busy.Message);
        }
        catch (ChatModelUnavailableException unavailable)
        {
            return Problem(statusCode: StatusCodes.Status502BadGateway, title: unavailable.Message);
        }

        // Saved only now, so a failed answer leaves no half-finished exchange.
        var now = DateTime.UtcNow;
        var asked = new AssistantMessage { ConversationId = conversation.Id, Role = "user", Content = question, CreatedAt = now };
        var answered = new AssistantMessage
        {
            ConversationId = conversation.Id,
            Role = "assistant",
            Content = answer.Text.Length > 8000 ? answer.Text[..8000] : answer.Text,
            ProductIds = answer.Products.Select(product => product.Id).ToList(),
            Suggestions = answer.Suggestions.ToList(),
            CreatedAt = now.AddTicks(1),
        };
        conversation.UpdatedAt = now;
        if (isNew) db.AssistantConversations.Add(conversation);
        db.AssistantMessages.AddRange(asked, answered);
        await db.SaveChangesAsync(cancellationToken);

        var cards = answer.Products.ToDictionary(product => product.Id, product => product.ToDto(userId));
        var summary = new AssistantConversationSummaryDto(conversation.Id, conversation.Title, conversation.ProductId, listing?.Title, Preview(answered.Content), conversation.UpdatedAt);
        return new AssistantExchangeDto(summary, ToDto(asked, cards), ToDto(answered, cards));
    }

    private IQueryable<AssistantConversationSummaryDto> Summaries(IQueryable<AssistantConversation> conversations) =>
        conversations.AsNoTracking().Select(conversation => new AssistantConversationSummaryDto(
            conversation.Id,
            conversation.Title,
            conversation.ProductId,
            db.Products.Where(product => product.Id == conversation.ProductId).Select(product => product.Title).FirstOrDefault(),
            conversation.Messages.OrderByDescending(message => message.Id).Select(message => message.Content.Length > PreviewLength ? message.Content.Substring(0, PreviewLength) + "…" : message.Content).FirstOrDefault() ?? "",
            conversation.UpdatedAt));

    /// <summary>Listings for cards, as they are now. Ones that were deleted or hidden since are left out.</summary>
    private async Task<Dictionary<string, ProductDto>> Cards(IEnumerable<string> ids, string userId, CancellationToken cancellationToken)
    {
        var wanted = ids.Distinct().ToList();
        if (wanted.Count == 0) return [];
        var products = await db.Products.AsNoTracking()
            .Where(product => wanted.Contains(product.Id) && (product.Status != ListingStatus.Inactive || product.SellerId == userId))
            .ToListAsync(cancellationToken);
        return products.ToDictionary(product => product.Id, product => product.ToDto(userId));
    }

    private static AssistantMessageDto ToDto(AssistantMessage message, IReadOnlyDictionary<string, ProductDto> cards) => new(
        message.Id, message.Role, message.Content,
        message.ProductIds.Where(cards.ContainsKey).Select(id => cards[id]).ToList(),
        message.Suggestions, message.CreatedAt);

    // Same visibility as the product page: inactive listings only for their seller.
    private Task<Product?> VisibleListing(string productId, string userId, CancellationToken cancellationToken) =>
        db.Products.AsNoTracking().SingleOrDefaultAsync(product => product.Id == productId && (product.Status != ListingStatus.Inactive || product.SellerId == userId), cancellationToken);

    private static string Title(string question)
    {
        var oneLine = string.Join(' ', question.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        return oneLine.Length <= TitleLength ? oneLine : oneLine[..(TitleLength - 1)].TrimEnd() + "…";
    }

    private static string Preview(string content) => content.Length > PreviewLength ? content[..PreviewLength] + "…" : content;

    private ActionResult Invalid(string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["message"] = [message] }));

    private ActionResult NotSetUp() =>
        Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The assistant isn't set up on this server yet.");
}
