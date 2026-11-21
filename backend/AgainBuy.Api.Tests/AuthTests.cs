using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Tests;

public class AuthTests
{
    [Fact]
    public async Task Demo_accounts_sign_in_with_their_role_and_permissions()
    {
        await using var factory = new ApiFactory();
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = " Customer@AgainBuy.demo ", password = SeedData.CustomerPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var auth = await response.Read<AuthResponse>();
        Assert.False(string.IsNullOrEmpty(auth.Token));
        Assert.Equal(UserRole.Customer, auth.User.Role);
        Assert.Equal("March 2024", auth.User.MemberSince);
        Assert.Contains(Permissions.ListingCreate, auth.User.Permissions);
        Assert.Contains("\"role\":\"customer\"", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Demo_buyer_is_a_second_customer()
    {
        await using var factory = new ApiFactory();
        var buyer = await factory.SignedInClient(SeedData.DemoBuyerEmail, SeedData.DemoBuyerPassword);

        var me = await (await buyer.GetAsync("/api/auth/me")).Read<UserDto>();
        Assert.Equal(UserRole.Customer, me.Role);
        Assert.Equal("Demo Buyer", me.Name);
    }

    [Fact]
    public async Task Wrong_password_is_rejected()
    {
        await using var factory = new ApiFactory();
        var response = await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = SeedData.AdminEmail, password = "NotThePassword1" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Registration_creates_a_customer_and_rejects_duplicates()
    {
        await using var factory = new ApiFactory();
        var client = factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/auth/register", new { name = "Nadeesha Silva", email = "nadeesha@example.com", password = "Secret123!" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(UserRole.Customer, (await created.Read<AuthResponse>()).User.Role);

        var duplicate = await client.PostAsJsonAsync("/api/auth/register", new { name = "Someone Else", email = "NADEESHA@example.com", password = "Secret123!" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var weak = await client.PostAsJsonAsync("/api/auth/register", new { name = "Short Pass", email = "short@example.com", password = "abc" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
    }

    [Fact]
    public async Task Protected_endpoints_require_a_token()
    {
        await using var factory = new ApiFactory();
        var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/products")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/categories")).StatusCode);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Roles_cannot_reach_each_others_areas()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        var admin = await factory.Admin();

        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/stats")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/products")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/transactions")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/stats")).StatusCode);
    }

    [Fact]
    public async Task Deactivating_an_account_revokes_its_existing_token()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        var admin = await factory.Admin();
        Assert.Equal(HttpStatusCode.OK, (await customer.GetAsync("/api/auth/me")).StatusCode);

        var deactivate = await admin.PatchAsJsonAsync($"/api/admin/users/{SeedData.CustomerId}/status", new { status = "Inactive" });
        Assert.Equal(HttpStatusCode.OK, deactivate.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await customer.GetAsync("/api/auth/me")).StatusCode);
        var login = await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = SeedData.CustomerEmail, password = SeedData.CustomerPassword });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
    }

    [Fact]
    public async Task Admins_cannot_lock_themselves_out()
    {
        await using var factory = new ApiFactory();
        var admin = await factory.Admin();

        var response = await admin.PatchAsJsonAsync($"/api/admin/users/{SeedData.AdminId}/status", new { status = "Inactive" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Profile_updates_flow_through_to_own_listings()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PutAsJsonAsync("/api/auth/me", new { name = "Maya P. Perera", location = "Colombo 04" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var mine = await (await customer.GetAsync("/api/products/mine")).Read<List<ProductDto>>();
        Assert.All(mine, product => Assert.Equal("Maya P. Perera", product.Seller));
    }
}
