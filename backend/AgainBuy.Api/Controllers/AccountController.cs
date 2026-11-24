using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AgainBuy.Api.Controllers;

/// <summary>Per-user settings edited from the app's Settings &amp; Help pages.</summary>
[ApiController]
[Route("api/account")]
[Authorize(Policy = Permissions.ProfileManageOwn)]
public class AccountController(AppDbContext db) : ControllerBase
{
    public const int MaxSavedLocations = 10;

    [HttpGet("settings")]
    public async Task<ActionResult<AccountSettingsDto>> GetSettings(CancellationToken cancellationToken)
    {
        var user = await db.Users.FindAsync([User.UserId()], cancellationToken);
        return user is null ? Unauthorized() : user.ToSettingsDto();
    }

    /// <summary>Replaces all settings; clients send the full object they loaded.</summary>
    [HttpPut("settings")]
    public async Task<ActionResult<AccountSettingsDto>> UpdateSettings(UpdateAccountSettingsRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (user is null) return Unauthorized();

        var locations = request.SavedLocations
            .Select(location => location.Trim())
            .Where(location => location.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (locations.Count > MaxSavedLocations)
            return Invalid($"Save up to {MaxSavedLocations} locations.");
        if (locations.Any(location => location.Length is < 2 or > 120))
            return Invalid("Each location must be 2 to 120 characters.");

        user.NotifyMessages = request.NotifyMessages;
        user.NotifyOrders = request.NotifyOrders;
        user.NotifyNews = request.NotifyNews;
        user.SavedLocations = locations;
        if (request.BankDetails is not null) user.BankDetails = request.BankDetails.Trim();
        await db.SaveChangesAsync(cancellationToken);
        return user.ToSettingsDto();
    }

    private ActionResult Invalid(string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["savedLocations"] = [message] }));
}
