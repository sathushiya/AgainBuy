using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;

namespace AgainBuy.Api.Tests;

public class OrderDeliveryTests
{
    [Fact]
    public async Task Shipping_records_tracking_generates_a_receipt_and_notifies_the_buyer()
    {
        await using var scenario = await OrderScenario.Start();
        var productId = await scenario.CreateDeliveryListing();
        var id = await scenario.PaidOrder(productId);
        Assert.Equal([OrderActions.Ship], (await scenario.Get(scenario.Seller, id)).Actions);

        Assert.Equal(HttpStatusCode.Forbidden, (await scenario.Act(scenario.Buyer, id, "ship", new { trackingNumber = "DX123456LK" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await scenario.Act(scenario.Seller, id, "ship", new { trackingNumber = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Act(scenario.Seller, id, "ready-for-pickup", new { })).StatusCode);

        var shipped = await (await scenario.Act(scenario.Seller, id, "ship", new { trackingNumber = " DX123456LK ", deliveryNotes = "Fragile" })).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.Shipped, shipped.Summary.Status);
        Assert.Equal(CourierService.Domex, shipped.Summary.Courier);
        Assert.Equal("DX123456LK", shipped.TrackingNumber);
        Assert.NotNull(shipped.DispatchedAt);
        Assert.True(shipped.Summary.HasDeliveryReceipt);
        Assert.StartsWith("RCPT-", shipped.DeliveryReceiptNumber);

        var notifications = await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>();
        Assert.Contains(notifications, notification => notification.Type == NotificationType.Shipped && notification.Body.Contains("DX123456LK"));
        Assert.Contains(notifications, notification => notification.Type == NotificationType.ReceiptGenerated);

        var link = await (await scenario.Buyer.GetAsync($"/api/orders/{id}/files/delivery-receipt/link")).Read<FileLinkDto>();
        var pdf = await scenario.Factory.CreateClient().GetAsync(link.Url);
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType);
        Assert.Equal("%PDF"u8.ToArray(), (await pdf.Content.ReadAsByteArrayAsync())[..4]);
    }

    [Fact]
    public async Task Only_the_buyer_can_confirm_delivery_which_completes_the_sale()
    {
        await using var scenario = await OrderScenario.Start();
        var productId = await scenario.CreateDeliveryListing();
        var id = await scenario.PaidOrder(productId);
        await scenario.Act(scenario.Seller, id, "ship", new { trackingNumber = "DX123456LK" });

        Assert.Equal(HttpStatusCode.Forbidden, (await scenario.Act(scenario.Seller, id, "confirm-delivery")).StatusCode);

        var completed = await (await scenario.Act(scenario.Buyer, id, "confirm-delivery")).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.Completed, completed.Summary.Status);
        Assert.NotNull(completed.DeliveredAt);
        Assert.NotNull(completed.CompletedAt);
        Assert.Empty(completed.Actions);
        Assert.Equal(
            [OrderStatus.Negotiating, OrderStatus.DealAgreed, OrderStatus.PaymentPending, OrderStatus.PaymentVerificationPending, OrderStatus.PaymentConfirmed, OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Completed],
            completed.History.Select(change => change.Status).Distinct());

        var product = await (await scenario.Buyer.GetAsync($"/api/products/{productId}")).Read<ProductDto>();
        Assert.Equal(ListingStatus.Sold, product.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Buyer.PostAsJsonAsync("/api/orders", new { productId })).StatusCode);

        var purchase = Assert.Single(await (await scenario.Buyer.GetAsync("/api/transactions?type=purchase")).Read<List<TransactionDto>>());
        Assert.Equal(18000, purchase.Amount);
        Assert.Equal(TransactionStatus.Completed, purchase.Status);
        Assert.Contains(await (await scenario.Seller.GetAsync("/api/transactions?type=sale")).Read<List<TransactionDto>>(), sale => sale.ProductId == productId && sale.Party == "Demo Buyer");
        Assert.Contains(await (await scenario.Seller.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.Delivered);
    }

    [Fact]
    public async Task Pickup_orders_are_marked_ready_instead_of_shipped()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.PaidOrder();
        Assert.Equal([OrderActions.ReadyForPickup], (await scenario.Get(scenario.Seller, id)).Actions);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Act(scenario.Seller, id, "ship", new { trackingNumber = "DX123456LK" })).StatusCode);

        var ready = await (await scenario.Act(scenario.Seller, id, "ready-for-pickup", new { pickupNotes = "Weekdays after 5pm" })).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.ReadyForPickup, ready.Summary.Status);
        Assert.Equal("Weekdays after 5pm", ready.DeliveryNotes);
        Assert.True(ready.Summary.HasDeliveryReceipt);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.ReadyForPickup);

        Assert.Equal(OrderStatus.Completed, (await (await scenario.Act(scenario.Buyer, id, "confirm-delivery")).Read<OrderDetailDto>()).Summary.Status);
    }
}
