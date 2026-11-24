using AgainBuy.Api.Assistant;

namespace AgainBuy.Api.Tests;

/// <summary>Stands in for Groq: records what the API sent and returns a canned reply or failure.</summary>
public sealed class FakeChatModel : IChatModel
{
    public bool IsConfigured { get; set; } = true;

    public string Reply { get; set; } = "Tap Reserve on the product page to hold it.";

    /// <summary>Thrown instead of replying, when set.</summary>
    public Exception? Failure { get; set; }

    public List<IReadOnlyList<ChatTurn>> Prompts { get; } = [];

    public Task<string> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken)
    {
        Prompts.Add(messages);
        return Failure is null ? Task.FromResult(Reply) : Task.FromException<string>(Failure);
    }
}
