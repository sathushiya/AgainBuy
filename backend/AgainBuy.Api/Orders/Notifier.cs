using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Orders;

/// <summary>
/// The app's single notification system. Notifications are added to the
/// caller's DbContext, so they are saved in the same transaction as the change
/// they describe.
/// </summary>
public class Notifier(AppDbContext db, TimeProvider time)
{
    public void Send(string userId, NotificationType type, string title, string body, string? orderId = null) =>
        db.Notifications.Add(new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Body = body,
            OrderId = orderId,
            CreatedAt = time.GetUtcNow().UtcDateTime,
        });
}
