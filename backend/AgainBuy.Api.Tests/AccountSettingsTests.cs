using System.Net;
using System.Net.Http.Json;
using AgainBuy.Api.Contracts;

namespace AgainBuy.Api.Tests;

public class AccountSettingsTests
{
    [Fact]
    public async Task New_accounts_get_alerts_on_and_no_saved_locations()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var settings = await (await customer.GetAsync("/api/account/settings")).Read<AccountSettingsDto>();
        Assert.True(settings.NotifyMessages);
        Assert.True(settings.NotifyOrders);
        Assert.False(settings.NotifyNews);
        Assert.Empty(settings.SavedLocations);
    }

    [Fact]
    public async Task Settings_are_saved_with_locations_trimmed_and_deduplicated()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var response = await customer.PutAsJsonAsync("/api/account/settings", new
        {
            notifyMessages = false,
            notifyOrders = true,
            notifyNews = true,
            savedLocations = new[] { "  Colombo 05 ", "Nugegoda", "colombo 05", "" },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var saved = await (await customer.GetAsync("/api/account/settings")).Read<AccountSettingsDto>();
        Assert.False(saved.NotifyMessages);
        Assert.True(saved.NotifyNews);
        Assert.Equal(["Colombo 05", "Nugegoda"], saved.SavedLocations);
    }

    [Fact]
    public async Task Bank_details_are_saved_and_kept_when_not_sent()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        await customer.PutAsJsonAsync("/api/account/settings", new { notifyMessages = true, notifyOrders = true, notifyNews = false, savedLocations = Array.Empty<string>(), bankDetails = " Maya Perera\nCommercial Bank 8012345678\nColombo 05 branch " });
        await customer.PutAsJsonAsync("/api/account/settings", new { notifyMessages = false, notifyOrders = true, notifyNews = false, savedLocations = Array.Empty<string>() });

        var settings = await (await customer.GetAsync("/api/account/settings")).Read<AccountSettingsDto>();
        Assert.Equal("Maya Perera\nCommercial Bank 8012345678\nColombo 05 branch", settings.BankDetails);
        Assert.False(settings.NotifyMessages);
    }

    [Fact]
    public async Task Too_many_or_too_short_locations_are_rejected()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();

        var tooMany = await customer.PutAsJsonAsync("/api/account/settings", new
        {
            notifyMessages = true, notifyOrders = true, notifyNews = false,
            savedLocations = Enumerable.Range(1, 11).Select(index => $"Location {index}").ToArray(),
        });
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);

        var tooShort = await customer.PutAsJsonAsync("/api/account/settings", new
        {
            notifyMessages = true, notifyOrders = true, notifyNews = false,
            savedLocations = new[] { "X" },
        });
        Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);
    }

    [Fact]
    public async Task Settings_need_a_signed_in_user_but_work_for_admins_too()
    {
        await using var factory = new ApiFactory();
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/account/settings")).StatusCode);

        var admin = await factory.Admin();
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/account/settings")).StatusCode);
    }
}
