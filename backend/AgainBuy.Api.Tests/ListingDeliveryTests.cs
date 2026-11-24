using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Tests;

public class ListingDeliveryTests
{
    private static Dictionary<string, object?> Listing() => new()
    {
        ["title"] = "Yamaha Acoustic Guitar",
        ["category"] = "Electronics",
        ["price"] = 25000,
        ["condition"] = "Good",
        ["brand"] = "Yamaha",
        ["model"] = "F310",
        ["usage"] = "1 year",
        ["purchaseYear"] = 2024,
        ["description"] = "Well-kept guitar with new strings, played at home only.",
        ["defects"] = "None",
        ["location"] = "Colombo 05",
    };

    [Fact]
    public async Task Listings_save_the_reason_for_selling_and_delivery_option()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var body = Listing();
        body["reasonForSelling"] = "  Upgraded to an electric guitar  ";
        body["delivery"] = "Delivery";
        body["courier"] = "Domex";
        var created = await (await customer.PostAsJsonAsync("/api/products", body)).Read<ProductDto>();
        Assert.Equal("Upgraded to an electric guitar", created.ReasonForSelling);
        Assert.Equal(DeliveryOption.Delivery, created.Delivery);
        Assert.Equal(CourierService.Domex, created.Courier);

        var json = await (await customer.GetAsync($"/api/products/{created.Id}")).Content.ReadAsStringAsync();
        Assert.Contains("\"delivery\":\"Delivery\",\"courier\":\"Domex\"", json);
    }

    [Fact]
    public async Task Delivery_needs_a_courier_and_pickup_ignores_one()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var noCourier = Listing();
        noCourier["delivery"] = "Delivery";
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", noCourier)).StatusCode);

        var pickup = Listing();
        pickup["delivery"] = "Meet-up";
        pickup["courier"] = "PickMe";
        Assert.Null((await (await customer.PostAsJsonAsync("/api/products", pickup)).Read<ProductDto>()).Courier);

        var both = Listing();
        both["delivery"] = "Both";
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", both)).StatusCode);
    }

    [Fact]
    public async Task Delivery_uses_the_chip_labels_and_defaults_to_meet_up()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var meetUp = Listing();
        meetUp["delivery"] = "Meet-up";
        Assert.Equal(DeliveryOption.MeetUp, (await (await customer.PostAsJsonAsync("/api/products", meetUp)).Read<ProductDto>()).Delivery);

        var unspecified = await (await customer.PostAsJsonAsync("/api/products", Listing())).Read<ProductDto>();
        Assert.Equal(DeliveryOption.MeetUp, unspecified.Delivery);
        Assert.Equal("", unspecified.ReasonForSelling);
    }

    [Fact]
    public async Task Unknown_delivery_options_and_long_reasons_are_rejected()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var badDelivery = Listing();
        badDelivery["delivery"] = "Drone";
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", badDelivery)).StatusCode);

        var longReason = Listing();
        longReason["reasonForSelling"] = new string('x', 301);
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", longReason)).StatusCode);
    }
}
