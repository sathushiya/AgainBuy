using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using AgainBuy.Api.Assistant;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace AgainBuy.Api.Tests;

/// <summary>The Groq client against a stub HTTP handler: request format and response parsing.</summary>
public class GroqChatModelTests
{
    private sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public string? Sent { get; private set; }
        public string? Authorization { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Sent = await request.Content!.ReadAsStringAsync(cancellationToken);
            Authorization = request.Headers.Authorization?.ToString();
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    private static GroqChatModel Model(StubHandler handler) =>
        new(new HttpClient(handler), Options.Create(new GroqOptions { ApiKey = "test-key" }), NullLogger<GroqChatModel>.Instance);

    private static readonly ChatTool Search = new(ListingSearch.ToolName, "Search", new JsonObject { ["type"] = "object" });

    [Fact]
    public async Task Sends_tools_and_tool_results_in_openai_format_and_reads_tool_calls()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """
            {"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_9","type":"function","function":{"name":"search_listings","arguments":"{\"category\":\"Phones\"}"}}]}}]}
            """);
        IReadOnlyList<ChatTurn> messages =
        [
            new("system", "Guide"),
            new("user", "Phones?"),
            new("assistant", "", ToolCalls: [new ToolCall("call_1", ListingSearch.ToolName, "{}")]),
            new("tool", """{"count":0}""", "call_1"),
        ];

        var result = await Model(handler).Complete(messages, [Search], CancellationToken.None);

        Assert.Equal("Bearer test-key", handler.Authorization);
        var sent = JsonNode.Parse(handler.Sent!)!;
        Assert.Equal("openai/gpt-oss-20b", sent["model"]!.GetValue<string>());
        Assert.Equal("search_listings", sent["tools"]![0]!["function"]!["name"]!.GetValue<string>());
        Assert.Equal("function", sent["tools"]![0]!["type"]!.GetValue<string>());
        var assistant = sent["messages"]![2]!;
        Assert.Null(assistant["content"]);
        Assert.Equal("call_1", assistant["tool_calls"]![0]!["id"]!.GetValue<string>());
        Assert.Equal("{}", assistant["tool_calls"]![0]!["function"]!["arguments"]!.GetValue<string>());
        Assert.Equal("call_1", sent["messages"]![3]!["tool_call_id"]!.GetValue<string>());

        Assert.Equal("", result.Content);
        var call = Assert.Single(result.ToolCalls);
        Assert.Equal(new ToolCall("call_9", "search_listings", """{"category":"Phones"}"""), call);
    }

    [Fact]
    public async Task Leaves_out_tools_when_none_are_offered_and_reads_text()
    {
        var handler = new StubHandler(HttpStatusCode.OK, """{"choices":[{"message":{"role":"assistant","content":" Hello! "}}]}""");

        var result = await Model(handler).Complete([new ChatTurn("user", "Hi")], [], CancellationToken.None);

        Assert.Null(JsonNode.Parse(handler.Sent!)!["tools"]);
        Assert.Equal(ChatResult.Text("Hello!").Content, result.Content);
        Assert.Empty(result.ToolCalls);
    }

    [Fact]
    public async Task Maps_rate_limits_and_errors()
    {
        await Assert.ThrowsAsync<ChatModelBusyException>(() => Model(new StubHandler(HttpStatusCode.TooManyRequests, "{}")).Complete([new ChatTurn("user", "Hi")], [], CancellationToken.None));
        await Assert.ThrowsAsync<ChatModelUnavailableException>(() => Model(new StubHandler(HttpStatusCode.Unauthorized, """{"error":"bad key"}""")).Complete([new ChatTurn("user", "Hi")], [], CancellationToken.None));
        await Assert.ThrowsAsync<ChatModelUnavailableException>(() => Model(new StubHandler(HttpStatusCode.OK, """{"choices":[{"message":{"content":""}}]}""")).Complete([new ChatTurn("user", "Hi")], [], CancellationToken.None));
    }
}
