using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Tests;

public class TransactionAndAdminTests
{
    [Fact]
    public async Task Purchases_reserve_the_item_and_can_be_cancelled()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var history = await (await customer.GetAsync("/api/transactions?type=purchase")).Read<List<TransactionDto>>();
        Assert.Equal(2, history.Count);
        Assert.Contains("\"status\":\"Meetup scheduled\"", await (await customer.GetAsync("/api/transactions/TX-2041")).Content.ReadAsStringAsync());

        var purchase = await customer.PostAsJsonAsync("/api/transactions", new { productId = "p5" });
        Assert.Equal(HttpStatusCode.Created, purchase.StatusCode);
        var order = await purchase.Read<TransactionDto>();
        Assert.Equal(TransactionStatus.MeetupScheduled, order.Status);
        Assert.Equal(28500, order.Amount);
        Assert.Equal(ListingStatus.Reserved, (await (await customer.GetAsync("/api/products/p5")).Read<ProductDto>()).Status);

        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/transactions", new { productId = "p5" })).StatusCode);

        var cancelled = await customer.PostAsync($"/api/transactions/{order.Id}/cancel", null);
        Assert.Equal(TransactionStatus.Cancelled, (await cancelled.Read<TransactionDto>()).Status);
        Assert.Equal(ListingStatus.Active, (await (await customer.GetAsync("/api/products/p5")).Read<ProductDto>()).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsync($"/api/transactions/{order.Id}/complete", null)).StatusCode);
    }

    [Fact]
    public async Task Buying_from_a_registered_seller_records_both_sides()
    {
        await using var factory = new ApiFactory();
        var seller = await factory.Customer();
        var buyer = factory.CreateClient();
        var registered = await buyer.PostAsJsonAsync("/api/auth/register", new { name = "Kamal Fernando", email = "kamal@example.com", password = "Secret123!" });
        buyer.DefaultRequestHeaders.Authorization = new("Bearer", (await registered.Read<AuthResponse>()).Token);

        var purchase = await buyer.PostAsJsonAsync("/api/transactions", new { productId = "mine_1" });
        Assert.Equal(HttpStatusCode.Created, purchase.StatusCode);
        var order = await purchase.Read<TransactionDto>();

        var sales = await (await seller.GetAsync("/api/transactions?type=sale")).Read<List<TransactionDto>>();
        var sale = Assert.Single(sales, transaction => transaction.ProductId == "mine_1");
        Assert.Equal("Kamal Fernando", sale.Party);

        await buyer.PostAsync($"/api/transactions/{order.Id}/complete", null);
        var settled = await (await seller.GetAsync($"/api/transactions/{sale.Id}")).Read<TransactionDto>();
        Assert.Equal(TransactionStatus.Completed, settled.Status);
        Assert.Equal(ListingStatus.Sold, (await (await seller.GetAsync("/api/products/mine_1")).Read<ProductDto>()).Status);
    }

    [Fact]
    public async Task Customers_cannot_buy_their_own_listing()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        Assert.Equal(HttpStatusCode.BadRequest, (await customer.PostAsJsonAsync("/api/transactions", new { productId = "mine_1" })).StatusCode);
    }

    [Fact]
    public async Task Admin_overview_reflects_seeded_platform()
    {
        await using var factory = new ApiFactory();
        var admin = await factory.Admin();

        var stats = await (await admin.GetAsync("/api/admin/stats")).Read<AdminStatsDto>();
        Assert.Equal(5, stats.TotalUsers);
        Assert.Equal(2, stats.ActiveCustomers);
        Assert.Equal(3, stats.Facilities);
        Assert.Equal(8, stats.ActiveListings);
        Assert.Equal(3, stats.PendingReviews);
        Assert.Equal(3, stats.RecentActivity.Count);

        var users = await (await admin.GetAsync("/api/admin/users?search=ruwan")).Read<List<PlatformUserDto>>();
        Assert.Equal(AccountStatus.Inactive, Assert.Single(users).Status);
    }

    [Fact]
    public async Task Facilities_and_categories_are_managed_by_admins()
    {
        await using var factory = new ApiFactory();
        var admin = await factory.Admin();

        var created = await admin.PostAsJsonAsync("/api/admin/facilities", new { name = "Kandy Reuse Point", location = "Kandy", resourceCount = 12, activeBookings = 0, status = "Operational" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var facility = await created.Read<FacilityDto>();

        var updated = await admin.PutAsJsonAsync($"/api/admin/facilities/{facility.Id}", new { name = facility.Name, location = "Kandy City", resourceCount = 14, activeBookings = 2, status = "Limited" });
        Assert.Equal(FacilityStatus.Limited, (await updated.Read<FacilityDto>()).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/facilities/{facility.Id}")).StatusCode);

        var category = await admin.PostAsJsonAsync("/api/admin/categories", new { name = "Toys" });
        Assert.Equal(HttpStatusCode.Created, category.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/admin/categories", new { name = "Toys" })).StatusCode);

        var categories = await (await factory.CreateClient().GetAsync("/api/categories")).Read<List<CategoryDto>>();
        Assert.Equal("Toys", categories[^1].Name);

        var phones = categories.Single(candidate => candidate.Name == "Phones");
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/admin/categories/{phones.Id}")).StatusCode);
    }

    [Fact]
    public async Task Reported_listings_can_be_removed_by_moderators()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        var admin = await factory.Admin();

        var report = await customer.PostAsJsonAsync("/api/products/p7/report", new { reason = "Photos look like stock images" });
        Assert.Equal(HttpStatusCode.Created, report.StatusCode);
        var moderation = await report.Read<ModerationCaseDto>();
        Assert.Equal(HttpStatusCode.Conflict, (await customer.PostAsJsonAsync("/api/products/p7/report", new { reason = "Again" })).StatusCode);

        var queue = await (await admin.GetAsync("/api/admin/moderation")).Read<List<ModerationCaseDto>>();
        Assert.Contains(queue, item => item.Id == moderation.Id);

        var removed = await admin.PostAsync($"/api/admin/moderation/{moderation.Id}/remove-listing", null);
        Assert.Equal(ModerationStatus.Removed, (await removed.Read<ModerationCaseDto>()).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync("/api/products/p7")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/admin/moderation/{moderation.Id}/dismiss", null)).StatusCode);
    }
}
