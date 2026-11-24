using AgainBuy.Api.Assistant;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Auth;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

/// <summary>
/// The in-app shopping assistant. Answers questions about AgainBuy and the
/// listing being viewed using a Groq model; the client keeps the conversation.
/// </summary>
[ApiController]
[Route("api/assistant")]
[Authorize]
[EnableRateLimiting(RateLimitPolicies.Assistant)]
public class AssistantController(AppDbContext db, IChatModel model, ListingSearch search) : ControllerBase
{
    // Older turns are dropped to keep requests small and within the model's limits.
    private const int HistoryTurns = 10;

    // Searches the model may run before it must answer.
    private const int MaxToolRounds = 3;

    // Listings shown as cards under an answer.
    private const int MaxCards = 6;

    [HttpPost("chat")]
    public async Task<ActionResult<AssistantReplyDto>> Chat(AssistantChatRequest request, CancellationToken cancellationToken)
    {
        if (!model.IsConfigured)
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The assistant isn't set up on this server yet.");
        if (request.Messages[^1].Role != "user" || string.IsNullOrWhiteSpace(request.Messages[^1].Content))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["messages"] = ["Ask a question first."] }));

        var viewerId = User.UserId();
        var categories = await db.Categories.AsNoTracking().OrderBy(category => category.SortOrder).ThenBy(category => category.Name).Select(category => category.Name).ToListAsync(cancellationToken);
        var prompt = new List<ChatTurn> { new("system", AssistantPrompt.Guide), new("system", $"Categories on AgainBuy: {string.Join(", ", categories)}.") };
        if (!string.IsNullOrWhiteSpace(request.ProductId))
        {
            var product = await db.Products.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == request.ProductId, cancellationToken);
            // Same visibility as the product page: inactive listings only for their seller.
            if (product is null || (product.Status == ListingStatus.Inactive && product.SellerId != viewerId)) return NotFound();
            prompt.Add(new ChatTurn("system", AssistantPrompt.Listing(product) + (product.SellerId == viewerId ? "The user is the seller of this listing." : "")));
        }
        prompt.AddRange(request.Messages.TakeLast(HistoryTurns).Select(turn => new ChatTurn(turn.Role, turn.Content.Trim())));

        try
        {
            var tools = new[] { ListingSearch.Tool(categories) };
            IReadOnlyList<Product> shown = [];
            for (var round = 0; ; round++)
            {
                // After the last allowed search, ask for an answer without tools.
                var result = await model.Complete(prompt, round < MaxToolRounds ? tools : [], cancellationToken);
                if (result.ToolCalls.Count == 0)
                {
                    if (result.Content.Length == 0) throw new ChatModelUnavailableException("The assistant didn't answer. Try asking another way.");
                    return new AssistantReplyDto(result.Content, shown.Take(MaxCards).Select(product => product.ToDto(viewerId)).ToList());
                }

                prompt.Add(new ChatTurn("assistant", result.Content, ToolCalls: result.ToolCalls));
                foreach (var call in result.ToolCalls)
                {
                    if (call.Name != ListingSearch.ToolName)
                    {
                        prompt.Add(new ChatTurn("tool", $$"""{"error":"Unknown tool {{call.Name}}. Only {{ListingSearch.ToolName}} exists."}""", call.Id));
                        continue;
                    }
                    var found = await search.Run(call.Arguments, viewerId, cancellationToken);
                    prompt.Add(new ChatTurn("tool", found.ToolText, call.Id));
                    // Cards follow the latest search that found something.
                    if (found.Products.Count > 0) shown = found.Products;
                }
            }
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
    }
}
