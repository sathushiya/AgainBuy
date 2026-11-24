using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(AppDbContext db, TimeProvider time) : ControllerBase
{
    /// <summary>The signed-in user's latest 50 notifications, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> List(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        return await db.Notifications.AsNoTracking()
            .Where(notification => notification.UserId == userId)
            .OrderByDescending(notification => notification.CreatedAt).ThenByDescending(notification => notification.Id)
            .Take(50)
            .Select(notification => new NotificationDto(notification.Id, notification.Type, notification.Title, notification.Body, notification.OrderId, notification.CreatedAt, notification.ReadAt != null))
            .ToListAsync(cancellationToken);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountDto>> UnreadCount(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        return new UnreadCountDto(await db.Notifications.CountAsync(notification => notification.UserId == userId && notification.ReadAt == null, cancellationToken));
    }

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var updated = await db.Notifications
            .Where(notification => notification.Id == id && notification.UserId == userId && notification.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(notification => notification.ReadAt, time.GetUtcNow().UtcDateTime), cancellationToken);
        return updated > 0 || await db.Notifications.AnyAsync(notification => notification.Id == id && notification.UserId == userId, cancellationToken) ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        await db.Notifications
            .Where(notification => notification.UserId == userId && notification.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(notification => notification.ReadAt, time.GetUtcNow().UtcDateTime), cancellationToken);
        return NoContent();
    }
}
