using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Controllers;
using AgainBuy.Api.Data;
using AgainBuy.Api.Images;

namespace AgainBuy.Api.Tests;

public class UploadTests
{
    // Smallest valid PNG header plus padding; enough for the signature check.
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1];

    private static MultipartFormDataContent Form(byte[] bytes, string fileName = "photo.png", string contentType = "image/png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private static object Listing(params string[] images) => new
    {
        title = "Yamaha Acoustic Guitar",
        category = "Electronics",
        price = 25000,
        condition = "Like new",
        brand = "Yamaha",
        model = "F310",
        usage = "1 year",
        purchaseYear = 2024,
        description = "Well-kept guitar with new strings, played at home only.",
        defects = "None",
        location = "Colombo 05",
        images,
    };

    [Fact]
    public async Task Customers_upload_photos_and_use_them_in_listings()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PostAsync("/api/uploads/images", Form(Png));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var image = await response.Read<StoredImage>();
        Assert.StartsWith("https://res.cloudinary.com/test-cloud/", image.Url);
        Assert.Equal(SeedData.CustomerId, Assert.Single(factory.Images.Uploads).UploaderId);

        var listing = await customer.PostAsJsonAsync("/api/products", Listing(image.Url));
        Assert.Equal(HttpStatusCode.Created, listing.StatusCode);
        Assert.Equal(image.Url, (await listing.Read<ProductDto>()).Image);
    }

    [Fact]
    public async Task Files_that_are_not_images_are_rejected_even_with_an_image_content_type()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PostAsync("/api/uploads/images", Form("<script>alert(1)</script>"u8.ToArray(), "evil.png"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(factory.Images.Uploads);
    }

    [Fact]
    public async Task Oversized_photos_are_rejected()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var tooBig = new byte[UploadsController.MaxImageBytes + 1];
        Png.CopyTo(tooBig, 0);
        var response = await customer.PostAsync("/api/uploads/images", Form(tooBig));
        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge, $"Got {response.StatusCode}");
        Assert.Empty(factory.Images.Uploads);
    }

    [Fact]
    public async Task Only_signed_in_customers_can_upload()
    {
        await using var factory = new ApiFactory();

        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsync("/api/uploads/images", Form(Png))).StatusCode);
        var admin = await factory.Admin();
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsync("/api/uploads/images", Form(Png))).StatusCode);
    }

    [Fact]
    public async Task Uploads_report_when_storage_is_not_configured()
    {
        await using var factory = new ApiFactory();
        factory.Images.IsConfigured = false;
        var customer = await factory.Customer();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await customer.PostAsync("/api/uploads/images", Form(Png))).StatusCode);
    }

    [Fact]
    public async Task With_cloudinary_configured_listings_only_accept_its_own_photos()
    {
        await using var factory = new ApiFactory { CloudName = "test-cloud" };
        var customer = await factory.Customer();

        var outside = await customer.PostAsJsonAsync("/api/products", Listing("https://images.example.com/guitar.jpg"));
        Assert.Equal(HttpStatusCode.BadRequest, outside.StatusCode);

        var otherCloud = await customer.PostAsJsonAsync("/api/products", Listing("https://res.cloudinary.com/someone-else/image/upload/v1/x.jpg"));
        Assert.Equal(HttpStatusCode.BadRequest, otherCloud.StatusCode);

        var ours = await customer.PostAsJsonAsync("/api/products", Listing("https://res.cloudinary.com/test-cloud/image/upload/v1/againbuy/listings/x.jpg"));
        Assert.Equal(HttpStatusCode.Created, ours.StatusCode);
    }
}
