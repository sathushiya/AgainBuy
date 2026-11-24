using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace AgainBuy.Api.Assistant;

/// <summary>Groq settings. The API key belongs in user-secrets or an environment variable (Groq__ApiKey), never in appsettings.</summary>
public class GroqOptions
{
    public const string Section = "Groq";

    public string ApiKey { get; set; } = "";

    /// <summary>A production model from https://console.groq.com/docs/models.</summary>
    public string Model { get; set; } = "openai/gpt-oss-20b";

    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";

    /// <summary>Includes any reasoning tokens the model spends before answering.</summary>
    public int MaxCompletionTokens { get; set; } = 1024;
}

public record ChatTurn(string Role, string Content);

/// <summary>A chat model that answers the shopping assistant's questions.</summary>
public interface IChatModel
{
    bool IsConfigured { get; }

    Task<string> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken);
}

/// <summary>The model is rate limited or overloaded; try again shortly.</summary>
public class ChatModelBusyException(string message) : Exception(message);

/// <summary>The model could not answer (bad key, outage, empty reply).</summary>
public class ChatModelUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>Calls Groq's OpenAI-compatible chat completions endpoint.</summary>
public class GroqChatModel(HttpClient http, IOptions<GroqOptions> options, ILogger<GroqChatModel> logger) : IChatModel
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private readonly GroqOptions _options = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<string> Complete(IReadOnlyList<ChatTurn> messages, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new ChatModelUnavailableException("The assistant is not set up on this server.");

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(_options.BaseUrl), "chat/completions"))
        {
            Content = JsonContent.Create(new
            {
                model = _options.Model,
                messages = messages.Select(turn => new { role = turn.Role, content = turn.Content }),
                temperature = 0.3,
                max_completion_tokens = _options.MaxCompletionTokens,
            }, options: Json),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Groq request failed");
            throw new ChatModelUnavailableException("The assistant could not be reached. Try again in a moment.", exception);
        }

        using (response)
        {
            if (response.StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable)
                throw new ChatModelBusyException("The assistant is busy right now. Try again in a minute.");
            if (!response.IsSuccessStatusCode)
            {
                // Log Groq's error (it never contains the key) but don't pass it to users.
                logger.LogWarning("Groq returned {Status}: {Body}", (int)response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken));
                throw new ChatModelUnavailableException("The assistant is unavailable right now. Try again later.");
            }

            var completion = await response.Content.ReadFromJsonAsync<Completion>(Json, cancellationToken);
            var reply = completion?.Choices?.FirstOrDefault()?.Message?.Content?.Trim();
            if (string.IsNullOrEmpty(reply)) throw new ChatModelUnavailableException("The assistant didn't answer. Try asking another way.");
            return reply;
        }
    }

    private record Completion(List<Choice>? Choices);

    private record Choice(ChoiceMessage? Message);

    private record ChoiceMessage(string? Content);
}
