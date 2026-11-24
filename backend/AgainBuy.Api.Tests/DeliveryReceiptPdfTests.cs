using System.Net;
using System.Text;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;
using Microsoft.Extensions.Logging.Abstractions;

namespace AgainBuy.Api.Tests;

public class DeliveryReceiptPdfTests
{
    // A real 1×1 PNG, so the photo path is exercised end to end.
    private static readonly byte[] Photo = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    private sealed class StubHandler(Func<HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond());
    }

    private static DeliveryReceiptPdf Renderer(Func<HttpResponseMessage> respond) =>
        new(new HttpClient(new StubHandler(respond)), NullLogger<DeliveryReceiptPdf>.Instance);

    private static Order Order(DeliveryOption method)
    {
        var seller = new User { Id = "seller", Name = "Maya Perera", Email = "maya@example.com" };
        var buyer = new User { Id = "buyer", Name = "Demo Buyer", Email = "buyer@example.com" };
        var product = new Product { Id = "p", Title = "Sony WH-1000XM4", Category = "Electronics", SellerName = seller.Name, Image = "https://images.example.com/headphones.jpg", Description = "Noise-cancelling headphones, lightly used.", Location = "Colombo 05" };
        return new Order
        {
            Id = "ORD-123", ProductId = product.Id, Product = product, BuyerId = buyer.Id, Buyer = buyer, SellerId = seller.Id, Seller = seller,
            Status = method == DeliveryOption.Delivery ? OrderStatus.Shipped : OrderStatus.ReadyForPickup,
            DeliveryMethod = method, Courier = method == DeliveryOption.Delivery ? CourierService.Domex : null,
            AgreedPrice = 26000, PaymentReference = "TRX-1", PaymentConfirmedAt = new DateTime(2026, 11, 20, 9, 0, 0, DateTimeKind.Utc),
            TrackingNumber = method == DeliveryOption.Delivery ? "DX123456LK" : "", DeliveryNotes = "Leave with the security desk",
            DispatchedAt = new DateTime(2026, 11, 21, 10, 0, 0, DateTimeKind.Utc),
        };
    }

    [Theory]
    [InlineData(DeliveryOption.Delivery)]
    [InlineData(DeliveryOption.MeetUp)]
    public async Task Receipts_render_as_pdfs_for_delivery_and_pickup(DeliveryOption method)
    {
        var pdf = await Renderer(() => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Photo) })
            .RenderAsync(Order(method), "RCPT-20261121-ABC", DateTime.UtcNow, CancellationToken.None);

        Assert.Equal("%PDF", Encoding.ASCII.GetString(pdf, 0, 4));
        Assert.True(pdf.Length > 1000);
    }

    [Fact]
    public async Task A_missing_product_photo_does_not_stop_the_receipt()
    {
        var withPhoto = await Renderer(() => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Photo) })
            .RenderAsync(Order(DeliveryOption.Delivery), "RCPT-1", DateTime.UtcNow, CancellationToken.None);
        var withoutPhoto = await Renderer(() => new HttpResponseMessage(HttpStatusCode.NotFound))
            .RenderAsync(Order(DeliveryOption.Delivery), "RCPT-1", DateTime.UtcNow, CancellationToken.None);
        var brokenPhoto = await Renderer(() => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent("not an image"u8.ToArray()) })
            .RenderAsync(Order(DeliveryOption.Delivery), "RCPT-1", DateTime.UtcNow, CancellationToken.None);

        Assert.Equal("%PDF", Encoding.ASCII.GetString(withoutPhoto, 0, 4));
        Assert.Equal("%PDF", Encoding.ASCII.GetString(brokenPhoto, 0, 4));
        Assert.True(withPhoto.Length > withoutPhoto.Length, "the photo is embedded when available");
    }
}
