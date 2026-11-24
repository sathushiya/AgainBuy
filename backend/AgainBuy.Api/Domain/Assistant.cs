namespace AgainBuy.Api.Domain;

/// <summary>One chat with the AI assistant, owned by a single user.</summary>
public class AssistantConversation
{
    public required string Id { get; set; }
    public required string UserId { get; set; }

    /// <summary>The first question, shortened; shown in History.</summary>
    public required string Title { get; set; }

    /// <summary>Set when the chat was started from a product page; every answer gets that listing's details.</summary>
    public string? ProductId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<AssistantMessage> Messages { get; set; } = [];
}

/// <summary>A question or an answer. Answers keep the listings shown as cards and the follow-up questions offered.</summary>
public class AssistantMessage
{
    public long Id { get; set; }
    public required string ConversationId { get; set; }

    /// <summary>"user" or "assistant".</summary>
    public required string Role { get; set; }

    public required string Content { get; set; }

    /// <summary>Listings shown as cards under an answer, in order.</summary>
    public List<string> ProductIds { get; set; } = [];

    /// <summary>The four follow-up questions offered after an answer.</summary>
    public List<string> Suggestions { get; set; } = [];

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
