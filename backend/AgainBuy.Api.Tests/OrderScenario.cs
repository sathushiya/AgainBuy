using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;

namespace AgainBuy.Api.Tests;

/// <summary>Maya (seller of "mine_1") and Demo Buyer, ready to run through an order.</summary>
public sealed class OrderScenario : IAsyncDisposable
{
    public const string ProductId = "mine_1";
    public const string BankDetails = "Maya Perera · Commercial Bank · 8012345678 · Colombo 05";

    public required ApiFactory Factory { get; init; }
    public required HttpClient Seller { get; init; }
    public required HttpClient Buyer { get; init; }

    public static async Task<OrderScenario> Start(string? cloudName = null)
    {
        var factory = new ApiFactory { CloudName = cloudName };
        return new OrderScenario
        {
            Factory = factory,
            Seller = await factory.Customer(),
            Buyer = await factory.SignedInClient(SeedData.DemoBuyerEmail, SeedData.DemoBuyerPassword),
        };
    }

    public async Task<OrderDetailDto> Reserve()
    {
        var response = await Buyer.PostAsJsonAsync("/api/orders", new { productId = ProductId });
        response.EnsureSuccessStatusCode();
        return await response.Read<OrderDetailDto>();
    }

    public async Task<OrderDetailDto> Get(HttpClient client, string orderId) =>
        await (await client.GetAsync($"/api/orders/{orderId}")).Read<OrderDetailDto>();

    public Task<HttpResponseMessage> Act(HttpClient client, string orderId, string action, object? body = null) =>
        body is null ? client.PostAsync($"/api/orders/{orderId}/{action}", null) : client.PostAsJsonAsync($"/api/orders/{orderId}/{action}", body);

    public Task SaveSellerBankDetails() =>
        Seller.PutAsJsonAsync("/api/account/settings", new { notifyMessages = true, notifyOrders = true, notifyNews = false, savedLocations = Array.Empty<string>(), bankDetails = BankDetails });

    /// <summary>Reserves the listing and has both parties agree, leaving the order waiting for payment.</summary>
    public async Task<string> AgreeDeal()
    {
        await SaveSellerBankDetails();
        var id = (await Reserve()).Summary.Id;
        (await Act(Buyer, id, "agree")).EnsureSuccessStatusCode();
        (await Act(Seller, id, "agree")).EnsureSuccessStatusCode();
        return id;
    }

    /// <summary>Smallest bytes that pass the PNG signature check.</summary>
    public static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52];

    public Task<HttpResponseMessage> UploadReceipt(HttpClient client, string orderId, byte[]? bytes = null, string reference = "TRX-445566")
    {
        var file = new ByteArrayContent(bytes ?? Png);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        return client.PostAsync($"/api/orders/{orderId}/payment-receipt", new MultipartFormDataContent { { file, "file", "receipt.png" }, { new StringContent(reference), "reference" } });
    }

    /// <summary>Paid and confirmed by the seller, ready to ship or hand over.</summary>
    public async Task<string> PaidOrder()
    {
        var id = await AgreeDeal();
        (await UploadReceipt(Buyer, id)).EnsureSuccessStatusCode();
        (await Act(Seller, id, "confirm-payment")).EnsureSuccessStatusCode();
        return id;
    }

    public ValueTask DisposeAsync() => Factory.DisposeAsync();
}
