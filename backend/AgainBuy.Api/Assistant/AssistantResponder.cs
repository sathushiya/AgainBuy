using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Assistant;

/// <summary>
/// Produces one assistant answer from a conversation's history: adds the app
/// guide, categories and (optionally) a listing, lets the model search live
/// listings, then splits off the four follow-up questions. Saves nothing.
/// </summary>
public class AssistantResponder(AppDbContext db, IChatModel model, ListingSearch search)
{
    // Older turns are dropped to keep requests small and within the model's limits.
    public const int HistoryTurns = 10;

    // Searches the model may run before it must answer.
    private const int MaxToolRounds = 3;

    // Listings shown as cards under an answer.
    private const int MaxCards = 6;

    public bool IsConfigured => model.IsConfigured;

    public record Answer(string Text, IReadOnlyList<string> Suggestions, IReadOnlyList<Product> Products);

    /// <param name="history">The conversation so far, oldest first, ending with the new question.</param>
    /// <exception cref="ChatModelBusyException">Groq is rate limited.</exception>
    /// <exception cref="ChatModelUnavailableException">Groq failed or gave no answer.</exception>
    public async Task<Answer> Respond(string? viewerId, Product? listing, IReadOnlyList<ChatTurn> history, CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking().OrderBy(category => category.SortOrder).ThenBy(category => category.Name).Select(category => category.Name).ToListAsync(cancellationToken);
        var prompt = new List<ChatTurn>
        {
            new("system", AssistantPrompt.Guide + "\n" + FollowUps.Instruction),
            new("system", $"Categories on AgainBuy: {string.Join(", ", categories)}."),
        };
        if (listing is not null)
            prompt.Add(new ChatTurn("system", AssistantPrompt.Listing(listing) + (listing.SellerId == viewerId ? "The user is the seller of this listing." : "")));
        prompt.AddRange(history.TakeLast(HistoryTurns));

        var tools = new[] { ListingSearch.Tool(categories) };
        var found = new List<Product>();
        for (var round = 0; ; round++)
        {
            // After the last allowed search, ask for an answer without tools.
            var result = await model.Complete(prompt, round < MaxToolRounds ? tools : [], cancellationToken);
            if (result.ToolCalls.Count == 0)
            {
                var asked = history.Where(turn => turn.Role == "user").Select(turn => turn.Content);
                var (answer, suggestions) = FollowUps.Split(result.Content, listing is not null, asked);
                if (answer.Length == 0) throw new ChatModelUnavailableException("The assistant didn't answer. Try asking another way.");
                // Cards only for listings the answer actually talks about.
                var cards = found.DistinctBy(product => product.Id).Where(product => Mentions(answer, product)).Take(MaxCards).ToList();
                return new Answer(answer, suggestions, cards);
            }

            prompt.Add(new ChatTurn("assistant", result.Content, ToolCalls: result.ToolCalls));
            foreach (var call in result.ToolCalls)
            {
                if (call.Name != ListingSearch.ToolName)
                {
                    prompt.Add(new ChatTurn("tool", $$"""{"error":"Unknown tool {{call.Name}}. Only {{ListingSearch.ToolName}} exists."}""", call.Id));
                    continue;
                }
                var results = await search.Run(call.Arguments, viewerId, cancellationToken);
                prompt.Add(new ChatTurn("tool", results.ToolText, call.Id));
                found.AddRange(results.Products);
            }
        }
    }

    /// <summary>Whether the answer names the listing: its full title, or the part before " · " (e.g. "iPhone 13").</summary>
    private static bool Mentions(string answer, Product product)
    {
        var shortTitle = product.Title.Split('·')[0].Trim();
        return answer.Contains(product.Title, StringComparison.OrdinalIgnoreCase) || (shortTitle.Length >= 4 && answer.Contains(shortTitle, StringComparison.OrdinalIgnoreCase));
    }
}
