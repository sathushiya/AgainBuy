using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;

namespace AgainBuy.Api.Tests;

public class OrderPaymentTests
{
    [Fact]
    public async Task Uploading_a_receipt_asks_the_seller_to_verify_but_never_confirms_payment()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.AgreeDeal();

        var uploaded = await (await scenario.UploadReceipt(scenario.Buyer, id)).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.PaymentVerificationPending, uploaded.Summary.Status);
        Assert.True(uploaded.HasPaymentReceipt);
        Assert.Equal("TRX-445566", uploaded.PaymentReference);
        Assert.Null(uploaded.PaymentConfirmedAt);
        Assert.Equal([OrderActions.UploadReceipt], uploaded.Actions);

        var sellerView = await scenario.Get(scenario.Seller, id);
        Assert.Equal([OrderActions.ConfirmPayment, OrderActions.RejectPayment], sellerView.Actions);
        Assert.Contains(await (await scenario.Seller.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.PaymentSubmitted);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Title == "Payment confirmation pending");
    }

    [Fact]
    public async Task Only_the_seller_confirms_payment_and_only_the_buyer_uploads_receipts()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.AgreeDeal();

        Assert.Equal(HttpStatusCode.Forbidden, (await scenario.UploadReceipt(scenario.Seller, id)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await scenario.Act(scenario.Seller, id, "confirm-payment")).StatusCode);
        await scenario.UploadReceipt(scenario.Buyer, id);
        Assert.Equal(HttpStatusCode.Forbidden, (await scenario.Act(scenario.Buyer, id, "confirm-payment")).StatusCode);

        var confirmed = await (await scenario.Act(scenario.Seller, id, "confirm-payment")).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.PaymentConfirmed, confirmed.Summary.Status);
        Assert.NotNull(confirmed.PaymentConfirmedAt);
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.PaymentConfirmed);
    }

    [Fact]
    public async Task Receipts_must_be_images_or_pdfs()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.AgreeDeal();

        Assert.Equal(HttpStatusCode.BadRequest, (await scenario.UploadReceipt(scenario.Buyer, id, "not a receipt at all"u8.ToArray())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await scenario.UploadReceipt(scenario.Buyer, id, "%PDF-1.7 receipt"u8.ToArray())).StatusCode);
    }

    [Fact]
    public async Task A_rejected_payment_goes_back_to_the_buyer()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.AgreeDeal();
        await scenario.UploadReceipt(scenario.Buyer, id);

        var rejected = await (await scenario.Act(scenario.Seller, id, "reject-payment", new { reason = "No transfer received yet" })).Read<OrderDetailDto>();
        Assert.Equal(OrderStatus.PaymentPending, rejected.Summary.Status);
        Assert.Contains(rejected.History, change => change.Note.Contains("No transfer received yet"));
        Assert.Contains(await (await scenario.Buyer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => notification.Type == NotificationType.PaymentRejected);
    }

    [Fact]
    public async Task Receipts_are_only_reachable_through_short_lived_links_for_the_two_parties()
    {
        await using var scenario = await OrderScenario.Start();
        var id = await scenario.AgreeDeal();
        await scenario.UploadReceipt(scenario.Buyer, id);

        var link = await (await scenario.Seller.GetAsync($"/api/orders/{id}/files/payment-receipt/link")).Read<FileLinkDto>();
        var download = await scenario.Factory.CreateClient().GetAsync(link.Url);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal(OrderScenario.Png, await download.Content.ReadAsByteArrayAsync());

        var stranger = await scenario.Factory.Admin();
        Assert.Equal(HttpStatusCode.Forbidden, (await stranger.GetAsync($"/api/orders/{id}/files/payment-receipt/link")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await scenario.Buyer.GetAsync($"/api/orders/{id}/files/delivery-receipt/link")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await scenario.Factory.CreateClient().GetAsync(link.Url + "tampered")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await scenario.Factory.CreateClient().GetAsync("/api/files/made-up-token")).StatusCode);
    }
}
