using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Tests;

public class MarketplaceTests
{
    private static object ValidListing(string title = "Yamaha Acoustic Guitar") => new
    {
        title,
        category = "Electronics",
        price = 25000,
        originalPrice = 42000,
        condition = "Like new",
        brand = "Yamaha",
        model = "F310",
        usage = "1 year",
        purchaseYear = 2024,
        description = "Well-kept guitar with new strings, played at home only.",
        defects = "None",
        accessories = "Gig bag",
        location = "Colombo 05",
        images = new[] { "https://images.example.com/guitar.jpg" },
    };

    [Fact]
    public async Task Browsing_filters_searches_and_sorts()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var all = await (await customer.GetAsync("/api/products?pageSize=50")).Read<PagedResult<ProductDto>>();
        Assert.Equal(9, all.Total);
        Assert.DoesNotContain(all.Items, product => product.Status == ListingStatus.Inactive);

        var likeNew = await (await customer.GetAsync("/api/products?condition=Like%20new")).Read<PagedResult<ProductDto>>();
        Assert.Equal("p3", Assert.Single(likeNew.Items).Id);

        var search = await (await customer.GetAsync("/api/products?search=macbook")).Read<PagedResult<ProductDto>>();
        Assert.Equal("p2", Assert.Single(search.Items).Id);

        var cheapest = await (await customer.GetAsync("/api/products?sort=price_asc&pageSize=1")).Read<PagedResult<ProductDto>>();
        Assert.Equal("p6", Assert.Single(cheapest.Items).Id);

        var phones = await (await customer.GetAsync("/api/products?category=Phones")).Read<PagedResult<ProductDto>>();
        Assert.All(phones.Items, product => Assert.Equal("Phones", product.Category));

        Assert.Equal(HttpStatusCode.BadRequest, (await customer.GetAsync("/api/products?condition=Broken")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.GetAsync("/api/products?sort=random")).StatusCode);
    }

    [Fact]
    public async Task Sellers_publish_edit_and_deactivate_their_listings()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var created = await customer.PostAsJsonAsync("/api/products", ValidListing());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var listing = await created.Read<ProductDto>();
        Assert.True(listing.IsOwn);
        Assert.Equal(ProductCondition.LikeNew, listing.Condition);
        Assert.Equal("Maya Perera", listing.Seller);
        Assert.Equal("https://images.example.com/guitar.jpg", listing.Image);

        var updated = await customer.PutAsJsonAsync($"/api/products/{listing.Id}", ValidListing("Yamaha F310 Acoustic Guitar"));
        Assert.Equal("Yamaha F310 Acoustic Guitar", (await updated.Read<ProductDto>()).Title);

        var mine = await (await customer.GetAsync("/api/products/mine")).Read<List<ProductDto>>();
        Assert.Contains(mine, product => product.Id == listing.Id);

        var deactivated = await customer.PostAsync($"/api/products/{listing.Id}/deactivate", null);
        Assert.Equal(ListingStatus.Inactive, (await deactivated.Read<ProductDto>()).Status);

        var browse = await (await customer.GetAsync("/api/products?search=Yamaha")).Read<PagedResult<ProductDto>>();
        Assert.Empty(browse.Items);

        var reactivated = await customer.PostAsync($"/api/products/{listing.Id}/activate", null);
        Assert.Equal(ListingStatus.Active, (await reactivated.Read<ProductDto>()).Status);
    }

    [Fact]
    public async Task Listing_validation_mirrors_the_sell_form()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PostAsJsonAsync("/api/products", new
        {
            title = "TV",
            category = "Spaceships",
            price = 0,
            condition = "Good",
            brand = "LG",
            model = "X",
            usage = "1y",
            purchaseYear = 2099,
            description = "Too short",
            defects = "None",
            location = "Kandy",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Add a clear product title.", body);
        Assert.Contains("Add at least 20 characters.", body);
    }

    [Fact]
    public async Task Sellers_cannot_touch_other_peoples_listings()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        Assert.Equal(HttpStatusCode.NotFound, (await customer.PostAsync("/api/products/p1/deactivate", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.PutAsJsonAsync("/api/products/p1", ValidListing())).StatusCode);
    }

    [Fact]
    public async Task Wishlist_add_and_remove_are_idempotent()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        Assert.Equal(["p1", "p3"], (await (await customer.GetAsync("/api/wishlist/ids")).Read<List<string>>()).Order());

        await customer.PutAsync("/api/wishlist/p2", null);
        await customer.PutAsync("/api/wishlist/p2", null);
        await customer.DeleteAsync("/api/wishlist/p1");

        var wishlist = await (await customer.GetAsync("/api/wishlist")).Read<List<ProductDto>>();
        Assert.Equal(["p2", "p3"], wishlist.Select(product => product.Id).Order());
        Assert.Equal(HttpStatusCode.NotFound, (await customer.PutAsync("/api/wishlist/missing", null)).StatusCode);
    }

    [Fact]
    public async Task Conversations_track_unread_messages_and_replies()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var inbox = await (await customer.GetAsync("/api/conversations")).Read<List<ConversationDto>>();
        var thread = Assert.Single(inbox, conversation => conversation.Id == "c1");
        Assert.Equal(2, thread.Unread);
        Assert.Equal("Nimal S.", thread.Person);
        Assert.Equal("Yes, you can inspect it this evening.", thread.LastMessage);
        Assert.Equal(DateTimeKind.Utc, thread.Time.Kind);

        var detail = await (await customer.GetAsync("/api/conversations/c1")).Read<ConversationDetailDto>();
        Assert.Equal(3, detail.Messages.Count);
        Assert.Equal(0, detail.Conversation.Unread);

        var reply = await customer.PostAsJsonAsync("/api/conversations/c1/messages", new { body = "Great, see you at 6!" });
        Assert.Equal(HttpStatusCode.Created, reply.StatusCode);
        Assert.True((await reply.Read<MessageDto>()).IsMine);

        var started = await customer.PostAsJsonAsync("/api/conversations", new { productId = "p2", message = "Is the MacBook battery original?" });
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var again = await customer.PostAsJsonAsync("/api/conversations", new { productId = "p2", message = "Also, any dead pixels?" });
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(2, (await again.Read<ConversationDetailDto>()).Messages.Count);

        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/conversations", new { productId = "mine_1", message = "Hello me" })).StatusCode);
    }

    [Fact]
    public async Task Other_users_cannot_read_a_conversation()
    {
        await using var factory = new ApiFactory();
        var stranger = factory.CreateClient();
        var registered = await stranger.PostAsJsonAsync("/api/auth/register", new { name = "Curious Person", email = "curious@example.com", password = "Secret123!" });
        stranger.DefaultRequestHeaders.Authorization = new("Bearer", (await registered.Read<AuthResponse>()).Token);

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync("/api/conversations/c1")).StatusCode);
        Assert.Empty(await (await stranger.GetAsync("/api/conversations")).Read<List<ConversationDto>>());
    }
}
