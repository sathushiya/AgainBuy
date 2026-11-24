using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace AgainBuy.Api.Assistant;

/// <summary>Groq settings. The API key belongs in user-secrets or an environment variable (Groq__ApiKey), never in appsettings.</summary>
public class GroqOptions
{
    public const string Section = "Groq";

    public string ApiKey { get; set; } = "";

    /// <summary>A production model from https://console.groq.com/docs/models that supports tool use.</summary>
    public string Model { get; set; } = "openai/gpt-oss-20b";

    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";

    /// <summary>Includes any reasoning tokens the model spends before answering.</summary>
    public int MaxCompletionTokens { get; set; } = 1024;
}

/// <summary>A function the model asked to run, with its arguments as JSON text.</summary>
public record ToolCall(string Id, string Name, string Arguments);

/// <summary>
/// One message in the conversation sent to the model: system, user or assistant
/// text; an assistant turn that requested tools (ToolCalls); or a tool's result (role "tool", ToolCallId).
/// </summary>
public record ChatTurn(string Role, string Content, string? ToolCallId = null, IReadOnlyList<ToolCall>? ToolCalls = null);

/// <summary>A function the model may call. Parameters is a JSON Schema object.</summary>
public record ChatTool(string Name, string Description, JsonObject Parameters);

/// <summary>The model's answer, or the tools it wants run first.</summary>
public record ChatResult(string Content, IReadOnlyList<ToolCall> ToolCalls)
{
    public static ChatResult Text(string content) => new(content, []);
}

/// <summary>A chat model that answers the shopping assistant's questions.</summary>
public interface IChatModel
{
    bool IsConfigured { get; }

    Task<ChatResult> Complete(IReadOnlyList<ChatTurn> messages, IReadOnlyList<ChatTool> tools, CancellationToken cancellationToken);
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

    public async Task<ChatResult> Complete(IReadOnlyList<ChatTurn> messages, IReadOnlyList<ChatTool> tools, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new ChatModelUnavailableException("The assistant is not set up on this server.");

        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(_options.BaseUrl), "chat/completions"))
        {
            Content = JsonContent.Create(Body(messages, tools), options: Json),
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

            var message = (await response.Content.ReadFromJsonAsync<Completion>(Json, cancellationToken))?.Choices?.FirstOrDefault()?.Message;
            var calls = (message?.ToolCalls ?? [])
                .Where(call => call.Function?.Name is { Length: > 0 })
                .Select(call => new ToolCall(call.Id ?? "", call.Function!.Name!, call.Function.Arguments ?? "{}"))
                .ToList();
            var content = message?.Content?.Trim() ?? "";
            if (calls.Count == 0 && content.Length == 0) throw new ChatModelUnavailableException("The assistant didn't answer. Try asking another way.");
            return new ChatResult(content, calls);
        }
    }

    /// <summary>The request body in OpenAI chat-completions format.</summary>
    public object Body(IReadOnlyList<ChatTurn> messages, IReadOnlyList<ChatTool> tools) => new
    {
        model = _options.Model,
        messages = messages.Select(turn => turn switch
        {
            { Role: "tool" } => (object)new { role = "tool", tool_call_id = turn.ToolCallId, content = turn.Content },
            { ToolCalls.Count: > 0 } => new
            {
                role = turn.Role,
                content = turn.Content.Length > 0 ? turn.Content : null,
                tool_calls = turn.ToolCalls.Select(call => new { id = call.Id, type = "function", function = new { name = call.Name, arguments = call.Arguments } }),
            },
            _ => new { role = turn.Role, content = turn.Content },
        }),
        tools = tools.Count == 0 ? null : tools.Select(tool => new { type = "function", function = new { name = tool.Name, description = tool.Description, parameters = tool.Parameters } }),
        temperature = 0.3,
        max_completion_tokens = _options.MaxCompletionTokens,
    };

    private record Completion(List<Choice>? Choices);

    private record Choice(ChoiceMessage? Message);

    private record ChoiceMessage(string? Content, [property: JsonPropertyName("tool_calls")] List<ResponseToolCall>? ToolCalls);

    private record ResponseToolCall(string? Id, ResponseFunction? Function);

    private record ResponseFunction(string? Name, string? Arguments);
}
