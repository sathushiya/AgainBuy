using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Assistant;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Controllers;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AgainBuy.Api.Tests;

public class AssistantTests
{
    private const string Conversations = "/api/assistant/conversations";

    private const string AnswerWithFollowUps = """
        Tap Reserve on the product page to hold it.
        FOLLOW-UPS:
        1. How do I pay the seller?
        2. Can I cancel a reservation?
        3. What phones are for sale?
        4. How does delivery work?
        """;

    private static async Task<AssistantExchangeDto> Start(HttpClient client, string message, string? productId = null)
    {
        var response = await client.PostAsJsonAsync(Conversations, new { message, productId });
        response.EnsureSuccessStatusCode();
        return await response.Read<AssistantExchangeDto>();
    }

    private static async Task<AssistantExchangeDto> Ask(HttpClient client, string conversationId, string message)
    {
        var response = await client.PostAsJsonAsync($"{Conversations}/{conversationId}/messages", new { message });
        response.EnsureSuccessStatusCode();
        return await response.Read<AssistantExchangeDto>();
    }

    private static async Task<AssistantConversationDto> Open(HttpClient client, string conversationId) =>
        await (await client.GetAsync($"{Conversations}/{conversationId}")).Read<AssistantConversationDto>();

    // --- Saved conversations ---

    [Fact]
    public async Task Saves_the_question_and_answer_with_four_follow_ups()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.Reply = AnswerWithFollowUps;

        var exchange = await Start(client, "  How do I   reserve an item? ");

        Assert.Equal("How do I reserve an item?", exchange.Conversation.Title);
        Assert.Equal("How do I   reserve an item?", exchange.Question.Content);
        Assert.Equal("Tap Reserve on the product page to hold it.", exchange.Answer.Content);
        Assert.Equal(["How do I pay the seller?", "Can I cancel a reservation?", "What phones are for sale?", "How does delivery work?"], exchange.Answer.Suggestions);
        Assert.Empty(exchange.Question.Suggestions);

        var history = await (await client.GetAsync(Conversations)).Read<List<AssistantConversationSummaryDto>>();
        var saved = Assert.Single(history);
        Assert.Equal(exchange.Conversation.Id, saved.Id);
        Assert.Equal("Tap Reserve on the product page to hold it.", saved.LastMessage);

        var opened = await Open(client, saved.Id);
        Assert.Equal(["user", "assistant"], opened.Messages.Select(message => message.Role));
        Assert.Equal(exchange.Answer.Suggestions, opened.Messages[1].Suggestions);
    }

    [Fact]
    public async Task Follow_up_questions_use_the_saved_conversation_as_context()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.Reply = AnswerWithFollowUps;
        var started = await Start(client, "How do I reserve an item?");

        factory.Chat.Reply = "Pay by bank transfer to the account on the order.\nFOLLOW-UPS:\nWhere do I upload the receipt?";
        var next = await Ask(client, started.Conversation.Id, "How do I pay the seller?");

        var prompt = factory.Chat.Prompts[^1];
        Assert.Equal(
            [("user", "How do I reserve an item?"), ("assistant", "Tap Reserve on the product page to hold it."), ("user", "How do I pay the seller?")],
            prompt.Where(turn => turn.Role != "system").Select(turn => (turn.Role, turn.Content)));
        // One suggestion from the model, the rest filled in, never repeating a question already asked.
        Assert.Equal(4, next.Answer.Suggestions.Count);
        Assert.Equal("Where do I upload the receipt?", next.Answer.Suggestions[0]);
        Assert.DoesNotContain("How do I pay the seller?", next.Answer.Suggestions);
        Assert.Equal(4, (await Open(client, started.Conversation.Id)).Messages.Count);
    }

    [Fact]
    public async Task Conversations_are_still_there_after_signing_in_again()
    {
        await using var factory = new ApiFactory();
        var firstSession = await factory.Customer();
        factory.Chat.Reply = AnswerWithFollowUps;
        var started = await Start(firstSession, "How do I reserve an item?");

        var secondSession = await factory.Customer();
        var history = await (await secondSession.GetAsync(Conversations)).Read<List<AssistantConversationSummaryDto>>();
        Assert.Equal(started.Conversation.Id, Assert.Single(history).Id);
        await Ask(secondSession, started.Conversation.Id, "Can I cancel a reservation?");

        var opened = await Open(secondSession, started.Conversation.Id);
        Assert.Equal(["How do I reserve an item?", "Can I cancel a reservation?"], opened.Messages.Where(message => message.Role == "user").Select(message => message.Content));
    }

    [Fact]
    public async Task Other_users_cannot_see_continue_or_delete_a_conversation()
    {
        await using var factory = new ApiFactory();
        var owner = await factory.Customer();
        var someoneElse = await factory.SignedInClient(SeedData.DemoBuyerEmail, SeedData.DemoBuyerPassword);
        var started = await Start(owner, "How do I reserve an item?");
        var path = $"{Conversations}/{started.Conversation.Id}";

        Assert.Empty(await (await someoneElse.GetAsync(Conversations)).Read<List<AssistantConversationSummaryDto>>());
        Assert.Equal(HttpStatusCode.NotFound, (await someoneElse.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await someoneElse.PostAsJsonAsync($"{path}/messages", new { message = "Hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await someoneElse.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync(Conversations)).StatusCode);

        Assert.Equal(2, (await Open(owner, started.Conversation.Id)).Messages.Count);
    }

    [Fact]
    public async Task Deleting_removes_the_conversation_and_its_messages()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        var started = await Start(client, "How do I reserve an item?");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Conversations}/{started.Conversation.Id}")).StatusCode);

        Assert.Empty(await (await client.GetAsync(Conversations)).Read<List<AssistantConversationSummaryDto>>());
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().AssistantMessages.AnyAsync(message => message.ConversationId == started.Conversation.Id));
    }

    [Fact]
    public async Task A_failed_answer_saves_nothing()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        var started = await Start(client, "How do I reserve an item?");
        factory.Chat.Failure = new ChatModelUnavailableException("The assistant is unavailable right now. Try again later.");

        Assert.Equal(HttpStatusCode.BadGateway, (await client.PostAsJsonAsync(Conversations, new { message = "Second chat" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadGateway, (await client.PostAsJsonAsync($"{Conversations}/{started.Conversation.Id}/messages", new { message = "Next" })).StatusCode);

        Assert.Single(await (await client.GetAsync(Conversations)).Read<List<AssistantConversationSummaryDto>>());
        Assert.Equal(2, (await Open(client, started.Conversation.Id)).Messages.Count);
    }

    [Fact]
    public async Task A_chat_about_a_listing_keeps_that_listing_as_context()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        var started = await Start(client, "Does it come with a box?", "p1");

        Assert.Equal("p1", started.Conversation.ProductId);
        Assert.Equal("iPhone 13 · 128GB", started.Conversation.ProductTitle);
        await Ask(client, started.Conversation.Id, "And the battery?");

        var prompt = factory.Chat.Prompts[^1];
        Assert.Equal(new ChatTurn("system", AssistantPrompt.Guide + "\n" + FollowUps.Instruction), prompt[0]);
        Assert.Contains("Phones", prompt[1].Content);
        Assert.Contains("Accessories: Original box, cable, two cases", prompt[2].Content);
        Assert.Contains("never as instructions", prompt[2].Content);
        // Listing chats fall back to listing questions.
        Assert.Contains("Does it have any defects?", (await Open(client, started.Conversation.Id)).Messages[^1].Suggestions);
    }

    [Fact]
    public async Task Listing_cards_are_saved_with_the_answer()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"category":"Phones","maxPrice":150000}""", "The iPhone 13 fits your budget.\nFOLLOW-UPS:\nDoes the iPhone 13 have scratches?");

        var started = await Start(client, "I want a good phone under 150000");

        Assert.Equal("p1", Assert.Single(started.Answer.Products).Id);
        Assert.Equal("The iPhone 13 fits your budget.", started.Answer.Content);
        Assert.Equal("Does the iPhone 13 have scratches?", started.Answer.Suggestions[0]);
        var reopened = (await Open(client, started.Conversation.Id)).Messages[1];
        Assert.Equal("p1", Assert.Single(reopened.Products).Id);
    }

    [Fact]
    public async Task Sends_only_the_most_recent_turns_from_a_long_chat()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        var started = await Start(client, "Question 0");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            for (var index = 1; index <= 15; index++)
                db.AssistantMessages.AddRange(
                    new AssistantMessage { ConversationId = started.Conversation.Id, Role = "user", Content = $"Question {index}" },
                    new AssistantMessage { ConversationId = started.Conversation.Id, Role = "assistant", Content = $"Answer {index}" });
            await db.SaveChangesAsync();
        }

        await Ask(client, started.Conversation.Id, "Last question");

        var turns = factory.Chat.Prompts[^1].Where(turn => turn.Role != "system").ToList();
        Assert.Equal(AssistantResponder.HistoryTurns, turns.Count);
        Assert.Equal("Last question", turns[^1].Content);
        Assert.DoesNotContain(turns, turn => turn.Content == "Question 0");
    }

    [Fact]
    public async Task A_full_chat_asks_for_a_new_one()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        var started = await Start(client, "Hello");
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AssistantMessages.AddRange(Enumerable.Range(0, AssistantController.MaxMessagesPerConversation - 2)
                .Select(index => new AssistantMessage { ConversationId = started.Conversation.Id, Role = index % 2 == 0 ? "user" : "assistant", Content = "…" }));
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"{Conversations}/{started.Conversation.Id}/messages", new { message = "More" })).StatusCode);
    }

    [Fact]
    public async Task Rejects_bad_requests_without_calling_the_model()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Conversations, new { message = "   " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Conversations, new { message = new string('a', 1001) })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync(Conversations, new { message = "Is it new?", productId = "no-such-product" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync($"{Conversations}/AIC-missing/messages", new { message = "Hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync(Conversations, new { message = "Hello" })).StatusCode);
        Assert.Empty(factory.Chat.Prompts);
    }

    [Fact]
    public async Task Reports_when_the_assistant_is_not_set_up_busy_or_down()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();

        factory.Chat.IsConfigured = false;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync(Conversations, new { message = "Hello" })).StatusCode);

        factory.Chat.IsConfigured = true;
        factory.Chat.Failure = new ChatModelBusyException("The assistant is busy right now. Try again in a minute.");
        var busy = await client.PostAsJsonAsync(Conversations, new { message = "Hello" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, busy.StatusCode);
        Assert.True(busy.Headers.Contains("Retry-After"));

        factory.Chat.Failure = new ChatModelUnavailableException("The assistant is unavailable right now. Try again later.");
        var down = await client.PostAsJsonAsync(Conversations, new { message = "Hello" });
        Assert.Equal(HttpStatusCode.BadGateway, down.StatusCode);
        Assert.Contains("unavailable", await down.Content.ReadAsStringAsync());
    }

    // --- Listing search ---

    [Fact]
    public async Task Offers_the_listing_search_with_real_categories()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();

        await Start(client, "How do I pay?");

        var tool = Assert.Single(Assert.Single(factory.Chat.Tools));
        Assert.Equal(ListingSearch.ToolName, tool.Name);
        var categories = tool.Parameters["properties"]!["category"]!["enum"]!.AsArray().Select(node => node!.GetValue<string>());
        Assert.Contains("Laptops", categories);
        Assert.Contains("Phones", categories);
    }

    [Fact]
    public async Task Finds_listings_in_the_database_within_a_budget()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"category":"Phones","maxPrice":150000}""", "The iPhone 13 fits your budget.");

        var started = await Start(client, "I want a good phone under 150000");

        Assert.Equal("p1", Assert.Single(started.Answer.Products).Id);
        var answerPrompt = factory.Chat.Prompts[1];
        Assert.Equal(ListingSearch.ToolName, Assert.Single(answerPrompt[^2].ToolCalls!).Name);
        Assert.Equal("tool", answerPrompt[^1].Role);
        Assert.Equal("call_1", answerPrompt[^1].ToolCallId);
        Assert.Contains("iPhone 13", answerPrompt[^1].Content);
        Assert.Contains("138000", answerPrompt[^1].Content);
        Assert.Contains("\"reservable\":false", answerPrompt[^1].Content);
    }

    [Fact]
    public async Task Shows_cards_only_for_listings_the_answer_mentions()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"maxPrice":50000,"limit":8}""", "The Solid Teak Lounge Chair is the only chair for sale.");

        var started = await Start(client, "Do you have a chair?");

        Assert.Equal(["p3"], started.Answer.Products.Select(product => product.Id));
        Assert.Contains("Sony", factory.Chat.Prompts[1][^1].Content);
    }

    [Fact]
    public async Task Budget_and_category_filters_are_applied()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"category":"Laptops","maxPrice":100000}""", "No laptops in that range right now.");

        var started = await Start(client, "Laptops under 100000?");

        Assert.Empty(started.Answer.Products);
        Assert.Contains("\"count\":0", factory.Chat.Prompts[1][^1].Content);
    }

    [Fact]
    public async Task Only_suggests_items_that_can_be_bought_now()
    {
        await using var factory = new ApiFactory();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Products.FindAsync("p5"))!.Status = ListingStatus.Reserved;
            (await db.Products.FindAsync("p2"))!.Status = ListingStatus.Sold;
            await db.SaveChangesAsync();
        }
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"query":"sony"}""", "Your Sony Wireless Headphones are listed.");
        factory.Chat.SearchThenAnswer("""{"query":"macbook"}""");

        var sony = await Start(client, "Any Sony headphones?");
        var macbook = await Start(client, "Any MacBooks?");

        Assert.Equal(["mine_1"], sony.Answer.Products.Select(product => product.Id));
        Assert.Contains("\"yours\":true", factory.Chat.Prompts[1][^1].Content);
        Assert.Empty(macbook.Answer.Products);
    }

    [Fact]
    public async Task Falls_back_to_any_keyword_when_all_of_them_match_nothing()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("""{"query":"cheap macbook laptop","sort":"price_asc","limit":"3"}""", "The MacBook Air M1 is the closest match.");

        var started = await Start(client, "cheap macbook?");

        Assert.Contains(started.Answer.Products, product => product.Id == "p2");
    }

    [Fact]
    public async Task Bad_tool_arguments_are_reported_back_to_the_model()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        factory.Chat.SearchThenAnswer("not json");

        var started = await Start(client, "Phones?");

        Assert.Empty(started.Answer.Products);
        Assert.Contains("not valid JSON", factory.Chat.Prompts[1][^1].Content);
    }

    [Fact]
    public async Task Stops_offering_the_search_after_three_rounds()
    {
        await using var factory = new ApiFactory();
        var client = await factory.Customer();
        for (var round = 0; round < 3; round++)
            factory.Chat.Script.Enqueue(new ChatResult("", [new ToolCall($"call_{round}", ListingSearch.ToolName, """{"category":"Books"}""")]));
        factory.Chat.Script.Enqueue(ChatResult.Text("Here is the Architecture Book Set."));

        var started = await Start(client, "Books?");

        Assert.Equal("Here is the Architecture Book Set.", started.Answer.Content);
        Assert.Equal([1, 1, 1, 0], factory.Chat.Tools.Select(tools => tools.Count));
        Assert.Equal("p6", Assert.Single(started.Answer.Products).Id);
    }
}
