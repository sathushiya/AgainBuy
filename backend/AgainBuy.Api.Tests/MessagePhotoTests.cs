using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;

namespace AgainBuy.Api.Tests;

public class MessagePhotoTests
{
    private const string Photo = "https://res.cloudinary.com/test-cloud/image/upload/v1/againbuy/listings/photo.jpg";

    [Fact]
    public async Task Photos_can_be_sent_with_or_without_a_caption()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var captioned = await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { body = "Here's the scratch I mentioned", imageUrl = Photo });
        Assert.Equal(HttpStatusCode.Created, captioned.StatusCode);
        var sent = await captioned.Read<MessageDto>();
        Assert.Equal(Photo, sent.ImageUrl);
        Assert.Equal("Here's the scratch I mentioned", sent.Body);

        var photoOnly = await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { imageUrl = Photo });
        Assert.Equal(HttpStatusCode.Created, photoOnly.StatusCode);
        Assert.Equal("", (await photoOnly.Read<MessageDto>()).Body);

        var thread = await (await customer.GetAsync("/api/conversations/c1")).Read<ConversationDetailDto>();
        Assert.Equal(Photo, thread.Messages[^1].ImageUrl);
        Assert.Equal("Photo", thread.Conversation.LastMessage);
    }

    [Fact]
    public async Task A_conversation_can_start_with_a_photo()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var started = await customer.PostAsJsonAsync("/api/conversations", new { productId = "p2", imageUrl = Photo });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        Assert.Equal(Photo, Assert.Single((await started.Read<ConversationDetailDto>()).Messages).ImageUrl);
    }

    [Fact]
    public async Task Messages_need_text_or_a_photo()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { body = "   " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/conversations", new { productId = "p2" })).StatusCode);
    }

    [Fact]
    public async Task With_cloudinary_configured_only_our_own_photos_are_accepted()
    {
        await using var factory = new ApiFactory { CloudName = "test-cloud" };
        var customer = await factory.Customer();

        var outside = await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { imageUrl = "https://example.com/tracking.gif" });
        Assert.Equal(HttpStatusCode.BadRequest, outside.StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { imageUrl = Photo })).StatusCode);
    }
}
