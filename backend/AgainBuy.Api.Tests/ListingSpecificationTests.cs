using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;

namespace AgainBuy.Api.Tests;

public class ListingSpecificationTests
{
    private static Dictionary<string, object?> PhoneListing(object specifications) => new()
    {
        ["title"] = "Samsung Galaxy S21 · 256GB",
        ["category"] = "Phones",
        ["price"] = 95000,
        ["condition"] = "Excellent",
        ["brand"] = "Samsung",
        ["model"] = "Galaxy S21",
        ["usage"] = "2 years",
        ["purchaseYear"] = 2023,
        ["description"] = "Looked after carefully, always in a case with a screen protector.",
        ["defects"] = "None",
        ["location"] = "Colombo 05",
        ["specifications"] = specifications,
    };

    [Fact]
    public async Task Specifications_are_saved_in_order_and_cleaned_up()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PostAsJsonAsync("/api/products", PhoneListing(new object[]
        {
            new { key = "storage", label = "Storage capacity", value = " 256 GB " },
            new { key = "phoneType", label = "Phone type", value = "Smartphone" },
            new { key = "ram", label = "RAM", value = "  " },
            new { key = "storage", label = "Storage capacity", value = "128 GB" },
            new { key = "batteryHealth", label = "Battery health", value = "88%" },
        }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var listing = await response.Read<ProductDto>();

        Assert.Equal(["storage", "phoneType", "batteryHealth"], listing.Specifications.Select(specification => specification.Key));
        Assert.Equal("256 GB", listing.Specifications[0].Value);

        var reloaded = await (await customer.GetAsync($"/api/products/{listing.Id}")).Read<ProductDto>();
        Assert.Equal(listing.Specifications, reloaded.Specifications);
    }

    [Fact]
    public async Task Listings_without_specifications_get_an_empty_list()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        Assert.Empty((await (await customer.GetAsync("/api/products/p1")).Read<ProductDto>()).Specifications);
    }

    [Fact]
    public async Task Oversized_specifications_are_rejected()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var tooMany = Enumerable.Range(1, 41).Select(index => new { key = $"detail{index}", label = "Detail", value = "x" }).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", PhoneListing(tooMany))).StatusCode);

        var tooLong = new[] { new { key = "storage", label = "Storage capacity", value = new string('x', 201) } };
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/products", PhoneListing(tooLong))).StatusCode);
    }
}
