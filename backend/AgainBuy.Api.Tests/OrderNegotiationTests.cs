using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;

namespace AgainBuy.Api.Tests;

public class OrderNegotiationTests
{
    [Fact]
    public async Task A_new_price_resets_both_agreements()
    {
        await using var scenario = await OrderScenario.Start();
        await scenario.SaveSellerBankDetails();
        var id = (await scenario.Reserve()).Summary.Id;

        await scenario.Act(scenario.Buyer, id, "agree");
        var proposed = await (await scenario.Act(scenario.Seller, id, "price", new { price = 26000 })).Read<OrderDetailDto>();

        Assert.Equal(26000, proposed.Summary.AgreedPrice);
        Assert.Null(proposed.BuyerAgreedAt);
        Assert.Equal(OrderStatus.Negotiating, proposed.Summary.Status);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.PriceChanged);
        Assert.Equal(HttpStatusCode.BadRequest, (await scenario.Act(scenario.Buyer, id, "price", new { price = 0 })).StatusCode);
    }

    [Fact]
    public async Task Both_parties_must_agree_before_payment_is_requested()
    {
        await using var scenario = await OrderScenario.Start();
        var id = (await scenario.Reserve()).Summary.Id;

        var buyerAgreed = await (await scenario.Act(scenario.Buyer, id, "agree")).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.Negotiating, buyerAgreed.Summary.Status);
        Assert.NotNull(buyerAgreed.BuyerAgreedAt);
        Assert.DoesNotContain(OrderActions.Agree, buyerAgreed.Actions);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Act(scenario.Buyer, id, "agree")).StatusCode);

        // The seller needs bank details on file so the buyer knows where to pay.
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Act(scenario.Seller, id, "agree")).StatusCode);
        Assert.Equal("", (await scenario.Get(scenario.Buyer, id)).PaymentInstructions);
        await scenario.SaveSellerBankDetails();

        var agreed = await (await scenario.Act(scenario.Seller, id, "agree")).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.PaymentPending, agreed.Summary.Status);
        Assert.NotNull(agreed.SellerAgreedAt);
        Assert.Contains(agreed.History, change => change.Status == OrderStatus.DealAgreed);

        var buyerView = await scenario.Get(scenario.Buyer, id);
        Assert.Equal(OrderScenario.BankDetails, buyerView.PaymentInstructions);
        Assert.Equal([OrderActions.UploadReceipt, OrderActions.Cancel], buyerView.Actions);
        Assert.Empty((await scenario.Get(scenario.Seller, id)).Actions);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Title == "Deal agreed");
    }

    [Fact]
    public async Task Only_the_buyer_can_remove_a_reservation_and_the_item_returns_to_the_marketplace()
    {
        await using var scenario = await OrderScenario.Start();
        var id = (await scenario.Reserve()).Summary.Id;

        Assert.Equal(HttpStatusCode.Forbidden, (await scenario.Act(scenario.Seller, id, "cancel")).StatusCode);

        var cancelled = await (await scenario.Act(scenario.Buyer, id, "cancel")).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.Cancelled, cancelled.Summary.Status);
        Assert.NotNull(cancelled.CancelledAt);
        Assert.Empty(cancelled.Actions);

        var product = await (await scenario.Buyer.GetAsync($"/api/products/{OrderScenario.ProductId}")).Read<ProductDto>();
        Assert.Equal(ListingStatus.Active, product.Status);
        Assert.Null(product.MyOrderId);
        Assert.Contains(await (await scenario.Seller.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.ReservationCancelled);

        // A cancelled order doesn't block a new reservation.
        Assert.Equal(HttpStatusCode.Created, (await scenario.Buyer.PostAsJsonAsync("/api/orders", new { productId = OrderScenario.ProductId })).StatusCode);
    }
}
