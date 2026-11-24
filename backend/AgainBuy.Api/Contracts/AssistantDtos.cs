using System.ComponentModel.DataAnnotations;

namespace AgainBuy.Api.Contracts;

/// <summary>Starts a conversation. ProductId when asked from a product page.</summary>
public record StartAssistantConversationRequest(
    [Required(ErrorMessage = "Ask a question first."), MaxLength(1000, ErrorMessage = "Keep your question under 1,000 characters.")] string Message,
    string? ProductId);

/// <summary>Asks the next question in an existing conversation.</summary>
public record AssistantQuestionRequest(
    [Required(ErrorMessage = "Ask a question first."), MaxLength(1000, ErrorMessage = "Keep your question under 1,000 characters.")] string Message);

/// <summary>A question ("user") or an answer ("assistant"). Answers carry listing cards and four follow-up questions.</summary>
public record AssistantMessageDto(long Id, string Role, string Content, IReadOnlyList<ProductDto> Products, IReadOnlyList<string> Suggestions, DateTime CreatedAt);

/// <summary>A conversation as listed in History.</summary>
public record AssistantConversationSummaryDto(string Id, string Title, string? ProductId, string? ProductTitle, string LastMessage, DateTime UpdatedAt);

public record AssistantConversationDto(AssistantConversationSummaryDto Conversation, IReadOnlyList<AssistantMessageDto> Messages);

/// <summary>What one question adds to a conversation: the saved question and its answer.</summary>
public record AssistantExchangeDto(AssistantConversationSummaryDto Conversation, AssistantMessageDto Question, AssistantMessageDto Answer);
