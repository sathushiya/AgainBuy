using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;

namespace AgainBuy.Api.Tests;

/// <summary>Maya (seller of "mine_1") and Demo Buyer, ready to run through an order.</summary>
public sealed class OrderScenario : IAsyncDisposable
{
    public const string ProductId = "mine_1";

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

    public ValueTask DisposeAsync() => Factory.DisposeAsync();
}
