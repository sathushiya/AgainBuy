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
public class AssistantController(AppDbContext db, IChatModel model) : ControllerBase
{
    // Older turns are dropped to keep requests small and within the model's limits.
    private const int HistoryTurns = 10;

    [HttpPost("chat")]
    public async Task<ActionResult<AssistantReplyDto>> Chat(AssistantChatRequest request, CancellationToken cancellationToken)
    {
        if (!model.IsConfigured)
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The assistant isn't set up on this server yet.");
        if (request.Messages[^1].Role != "user" || string.IsNullOrWhiteSpace(request.Messages[^1].Content))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["messages"] = ["Ask a question first."] }));

        var prompt = new List<ChatTurn> { new("system", AssistantPrompt.Guide) };
        if (!string.IsNullOrWhiteSpace(request.ProductId))
        {
            var viewerId = User.UserId();
            var product = await db.Products.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == request.ProductId, cancellationToken);
            // Same visibility as the product page: inactive listings only for their seller.
            if (product is null || (product.Status == ListingStatus.Inactive && product.SellerId != viewerId)) return NotFound();
            prompt.Add(new ChatTurn("system", AssistantPrompt.Listing(product) + (product.SellerId == viewerId ? "The user is the seller of this listing." : "")));
        }
        prompt.AddRange(request.Messages.TakeLast(HistoryTurns).Select(turn => new ChatTurn(turn.Role, turn.Content.Trim())));

        try
        {
            return new AssistantReplyDto(await model.Complete(prompt, cancellationToken));
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
