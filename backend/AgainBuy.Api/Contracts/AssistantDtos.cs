using System.ComponentModel.DataAnnotations;

namespace AgainBuy.Api.Contracts;

public record AssistantTurn(
    [Required, RegularExpression("^(user|assistant)$", ErrorMessage = "Role must be user or assistant.")] string Role,
    [Required, MaxLength(1000, ErrorMessage = "Keep each message under 1,000 characters.")] string Content);

public record AssistantChatRequest(
    // The conversation so far, oldest first, ending with the user's new question.
    [Required, MinLength(1), MaxLength(40)] List<AssistantTurn> Messages,
    // Set when the chat was opened from a product page.
    string? ProductId);

public record AssistantReplyDto(string Reply);
