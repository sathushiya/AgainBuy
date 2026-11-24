using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;

namespace AgainBuy.Api.Tests;

public class OrderReservationTests
{
    [Fact]
    public async Task Reserving_starts_a_negotiation_and_hides_the_item_from_other_buyers()
    {
        await using var scenario = await OrderScenario.Start();
        var order = await scenario.Reserve();

        Assert.Equal(OrderStatus.Negotiating, order.Summary.Status);
        Assert.Equal(SeedData.CustomerId, order.Seller.Id);
        Assert.Equal(28500, order.Summary.AgreedPrice);
        Assert.NotNull(order.ConversationId);
        Assert.Equal([OrderActions.ProposePrice, OrderActions.Agree, OrderActions.Cancel], order.Actions);
        Assert.Single(order.History);

        var product = await (await scenario.Buyer.GetAsync($"/api/products/{OrderScenario.ProductId}")).Read<ProductDto>();
        Assert.Equal(ListingStatus.Reserved, product.Status);
        Assert.Equal(order.Summary.Id, product.MyOrderId);
        var browse = await (await scenario.Buyer.GetAsync("/api/products?search=Sony&pageSize=50")).Read<PagedResult<ProductDto>>();
        Assert.DoesNotContain(browse.Items, item => item.Id == OrderScenario.ProductId);

        var sellerView = Assert.Single(await (await scenario.Seller.GetAsync("/api/orders?as=seller")).Read<List<OrderSummaryDto>>());
        Assert.False(sellerView.IsBuyer);
        Assert.Equal("Demo Buyer", sellerView.OtherParty.Name);
        Assert.Contains(await (await scenario.Seller.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.Reserved && notification.OrderId == order.Summary.Id);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Title == "Product reserved");

        var chat = await (await scenario.Seller.GetAsync($"/api/conversations/{order.ConversationId}")).Read<ConversationDetailDto>();
        Assert.Contains("reserved", chat.Messages[^1].Body);
    }

    [Fact]
    public async Task Reservations_are_refused_when_they_would_conflict()
    {
        await using var scenario = await OrderScenario.Start();
        await scenario.Reserve();

        var third = await scenario.Factory.SignedInClient(SeedData.AdminEmail, SeedData.AdminPassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await third.PostAsJsonAsync("/api/orders", new { productId = OrderScenario.ProductId })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Buyer.PostAsJsonAsync("/api/orders", new { productId = OrderScenario.ProductId })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await scenario.Seller.PostAsJsonAsync("/api/orders", new { productId = OrderScenario.ProductId })).StatusCode);
        // Seeded demo listings have no seller account to confirm a deal.
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Buyer.PostAsJsonAsync("/api/orders", new { productId = "p1" })).StatusCode);
    }

    [Fact]
    public async Task Only_the_buyer_and_seller_can_see_an_order()
    {
        await using var scenario = await OrderScenario.Start();
        var order = await scenario.Reserve();

        var stranger = scenario.Factory.CreateClient();
        var registered = await stranger.PostAsJsonAsync("/api/auth/register", new { name = "Curious Person", email = "curious@example.com", password = "Secret123!" });
        stranger.DefaultRequestHeaders.Authorization = new("Bearer", (await registered.Read<AuthResponse>()).Token);

        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/orders/{order.Summary.Id}")).StatusCode);
        Assert.Empty(await (await stranger.GetAsync("/api/orders?as=buyer")).Read<List<OrderSummaryDto>>());
        Assert.Equal(HttpStatusCode.BadRequest, (await stranger.GetAsync("/api/orders?as=admin")).StatusCode);
    }

    [Fact]
    public async Task A_reserved_listing_cannot_be_deactivated_by_its_seller()
    {
        await using var scenario = await OrderScenario.Start();
        await scenario.Reserve();
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Seller.PostAsync($"/api/products/{OrderScenario.ProductId}/deactivate", null)).StatusCode);
    }
}
