using System.Net;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Orders;
using Microsoft.Extensions.DependencyInjection;

namespace AgainBuy.Api.Tests;

public class NotificationTests
{
    private static async Task Notify(ApiFactory factory, string userId, string title)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<Notifier>().Send(userId, NotificationType.Reserved, title, "Body");
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().SaveChangesAsync();
    }

    [Fact]
    public async Task Users_see_and_clear_only_their_own_notifications()
    {
        await using var factory = new ApiFactory();
        var customer = await factory.Customer();
        var other = await factory.SignedInClient(SeedData.DemoBuyerEmail, SeedData.DemoBuyerPassword);
        await Notify(factory, SeedData.CustomerId, "First");
        await Notify(factory, SeedData.CustomerId, "Second");

        var list = await (await customer.GetAsync("/api/notifications")).Read<List<NotificationDto>>();
        Assert.Equal(["Second", "First"], list.Select(notification => notification.Title));
        Assert.Equal(2, (await (await customer.GetAsync("/api/notifications/unread-count")).Read<UnreadCountDto>()).Count);

        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"/api/notifications/{list[0].Id}/read", null)).StatusCode);
        Assert.Empty(await (await other.GetAsync("/api/notifications")).Read<List<NotificationDto>>());

        Assert.Equal(HttpStatusCode.NoContent, (await customer.PostAsync($"/api/notifications/{list[0].Id}/read", null)).StatusCode);
        Assert.Equal(1, (await (await customer.GetAsync("/api/notifications/unread-count")).Read<UnreadCountDto>()).Count);

        await customer.PostAsync("/api/notifications/read-all", null);
        Assert.Equal(0, (await (await customer.GetAsync("/api/notifications/unread-count")).Read<UnreadCountDto>()).Count);
        Assert.All(await (await customer.GetAsync("/api/notifications")).Read<List<NotificationDto>>(), notification => Assert.True(notification.Read));
    }
}
