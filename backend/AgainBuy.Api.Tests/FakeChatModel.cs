using AgainBuy.Api.Assistant;

namespace AgainBuy.Api.Tests;

/// <summary>Stands in for Groq: records what the API sent and returns scripted results.</summary>
public sealed class FakeChatModel : IChatModel
{
    public bool IsConfigured { get; set; } = true;

    /// <summary>Returned when Script is empty.</summary>
    public string Reply { get; set; } = "Tap Reserve on the product page to hold it.";

    /// <summary>Results to return in order, e.g. a tool call and then the final answer.</summary>
    public Queue<ChatResult> Script { get; } = new();

    /// <summary>Thrown instead of replying, when set.</summary>
    public Exception? Failure { get; set; }

    /// <summary>Each request's messages (copied, since the API keeps adding to its list).</summary>
    public List<IReadOnlyList<ChatTurn>> Prompts { get; } = [];

    public List<IReadOnlyList<ChatTool>> Tools { get; } = [];

    public Task<ChatResult> Complete(IReadOnlyList<ChatTurn> messages, IReadOnlyList<ChatTool> tools, CancellationToken cancellationToken)
    {
        Prompts.Add(messages.ToList());
        Tools.Add(tools);
        if (Failure is not null) return Task.FromException<ChatResult>(Failure);
        return Task.FromResult(Script.Count > 0 ? Script.Dequeue() : ChatResult.Text(Reply));
    }

    /// <summary>Scripts a search_listings call followed by a final answer.</summary>
    public void SearchThenAnswer(string arguments, string answer = "Here are some options.")
    {
        Script.Enqueue(new ChatResult("", [new ToolCall("call_1", ListingSearch.ToolName, arguments)]));
        Script.Enqueue(ChatResult.Text(answer));
    }
}
