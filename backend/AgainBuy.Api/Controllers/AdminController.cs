using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController(AppDbContext db, TimeProvider time) : ControllerBase
{
    private static readonly ModerationStatus[] OpenStatuses = [ModerationStatus.Pending, ModerationStatus.EvidenceRequested, ModerationStatus.Urgent];

    // ---- Overview -------------------------------------------------------

    [HttpGet("stats")]
    [Authorize(Policy = Permissions.PlatformAnalytics)]
    public async Task<ActionResult<AdminStatsDto>> Stats(CancellationToken cancellationToken)
    {
        var recent = await db.ActivityLogs.AsNoTracking()
            .OrderByDescending(activity => activity.At).Take(10)
            .Select(activity => new ActivityDto(activity.Description, activity.At))
            .ToListAsync(cancellationToken);

        return new AdminStatsDto(
            TotalUsers: await db.Users.CountAsync(cancellationToken),
            ActiveCustomers: await db.Users.CountAsync(user => user.Role == UserRole.Customer && user.Status == AccountStatus.Active, cancellationToken),
            Facilities: await db.Facilities.CountAsync(cancellationToken),
            ActiveListings: await db.Products.CountAsync(product => product.Status == ListingStatus.Active, cancellationToken),
            PendingReviews: await db.ModerationCases.CountAsync(moderation => OpenStatuses.Contains(moderation.Status), cancellationToken),
            ReportsAndFlags: await db.ModerationCases.CountAsync(moderation => moderation.ReportedById != null && OpenStatuses.Contains(moderation.Status), cancellationToken),
            RecentActivity: recent);
    }

    // ---- Users ----------------------------------------------------------

    [HttpGet("users")]
    [Authorize(Policy = Permissions.PlatformUserManage)]
    public async Task<ActionResult<IReadOnlyList<PlatformUserDto>>> Users([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            query = query.Where(user => EF.Functions.ILike(user.Name, pattern, "\\") || EF.Functions.ILike(user.Email, pattern, "\\"));
        }

        var users = await query.OrderBy(user => user.Name).ToListAsync(cancellationToken);
        return users.Select(user => user.ToPlatformDto()).ToList();
    }

    [HttpPatch("users/{id}/status")]
    [Authorize(Policy = Permissions.PlatformUserManage)]
    public async Task<ActionResult<PlatformUserDto>> SetUserStatus(string id, UpdateUserStatusRequest request, CancellationToken cancellationToken)
    {
        if (id == User.UserId())
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You cannot change the status of your own account.");

        var user = await db.Users.FindAsync([id], cancellationToken);
        if (user is null) return NotFound();

        user.Status = request.Status!.Value;
        Log($"User {user.Email} set to {user.Status}");
        await db.SaveChangesAsync(cancellationToken);
        return user.ToPlatformDto();
    }

    [HttpPatch("users/{id}/role")]
    [Authorize(Policy = Permissions.PlatformUserManage)]
    public async Task<ActionResult<PlatformUserDto>> SetUserRole(string id, UpdateUserRoleRequest request, CancellationToken cancellationToken)
    {
        if (id == User.UserId())
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You cannot change your own role.");

        var user = await db.Users.FindAsync([id], cancellationToken);
        if (user is null) return NotFound();

        user.Role = request.Role!.Value;
        Log($"User {user.Email} role changed to {TokenService.RoleName(user.Role)}");
        await db.SaveChangesAsync(cancellationToken);
        return user.ToPlatformDto();
    }

    // ---- Facilities -----------------------------------------------------

    [HttpGet("facilities")]
    [Authorize(Policy = Permissions.PlatformFacilityManage)]
    public async Task<ActionResult<IReadOnlyList<FacilityDto>>> Facilities(CancellationToken cancellationToken)
    {
        var facilities = await db.Facilities.AsNoTracking().OrderBy(facility => facility.Name).ToListAsync(cancellationToken);
        return facilities.Select(facility => facility.ToDto()).ToList();
    }

    [HttpPost("facilities")]
    [Authorize(Policy = Permissions.PlatformFacilityManage)]
    public async Task<ActionResult<FacilityDto>> CreateFacility(UpsertFacilityRequest request, CancellationToken cancellationToken)
    {
        var facility = new Facility { Id = Ids.New("fac_"), Name = "", Location = "" };
        Apply(facility, request);
        db.Facilities.Add(facility);
        Log($"Facility {facility.Name} created");
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, facility.ToDto());
    }

    [HttpPut("facilities/{id}")]
    [Authorize(Policy = Permissions.PlatformFacilityManage)]
    public async Task<ActionResult<FacilityDto>> UpdateFacility(string id, UpsertFacilityRequest request, CancellationToken cancellationToken)
    {
        var facility = await db.Facilities.FindAsync([id], cancellationToken);
        if (facility is null) return NotFound();

        Apply(facility, request);
        Log("Facility record updated");
        await db.SaveChangesAsync(cancellationToken);
        return facility.ToDto();
    }

    [HttpDelete("facilities/{id}")]
    [Authorize(Policy = Permissions.PlatformFacilityManage)]
    public async Task<IActionResult> DeleteFacility(string id, CancellationToken cancellationToken)
    {
        var facility = await db.Facilities.FindAsync([id], cancellationToken);
        if (facility is null) return NotFound();

        db.Facilities.Remove(facility);
        Log($"Facility {facility.Name} removed");
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ---- Categories -----------------------------------------------------

    [HttpPost("categories")]
    [Authorize(Policy = Permissions.PlatformCategoryManage)]
    public async Task<ActionResult<CategoryDto>> CreateCategory(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Equals("All", StringComparison.OrdinalIgnoreCase) || await db.Categories.AnyAsync(category => category.Name == name, cancellationToken))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This category already exists.");

        var nextOrder = await db.Categories.Select(category => (int?)category.SortOrder).MaxAsync(cancellationToken) ?? -1;
        var category = new Category { Name = name, SortOrder = nextOrder + 1 };
        db.Categories.Add(category);
        Log($"Category {name} created");
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new CategoryDto(category.Id, category.Name));
    }

    [HttpDelete("categories/{id:int}")]
    [Authorize(Policy = Permissions.PlatformCategoryManage)]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken cancellationToken)
    {
        var category = await db.Categories.FindAsync([id], cancellationToken);
        if (category is null) return NotFound();
        if (await db.Products.AnyAsync(product => product.Category == category.Name && product.Status != ListingStatus.Inactive, cancellationToken))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Move or deactivate this category's listings before removing it.");

        db.Categories.Remove(category);
        Log($"Category {category.Name} removed");
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // ---- Moderation -----------------------------------------------------

    [HttpGet("moderation")]
    [Authorize(Policy = Permissions.PlatformListingModerate)]
    public async Task<ActionResult<IReadOnlyList<ModerationCaseDto>>> Moderation([FromQuery] bool includeResolved = false, CancellationToken cancellationToken = default)
    {
        var query = db.ModerationCases.AsNoTracking();
        if (!includeResolved) query = query.Where(moderation => OpenStatuses.Contains(moderation.Status));
        var cases = await query.OrderByDescending(moderation => moderation.CreatedAt).ToListAsync(cancellationToken);
        return cases.Select(moderation => moderation.ToDto()).ToList();
    }

    [HttpPost("moderation/{id}/request-evidence")]
    [Authorize(Policy = Permissions.PlatformListingModerate)]
    public Task<ActionResult<ModerationCaseDto>> RequestEvidence(string id, CancellationToken cancellationToken) =>
        Resolve(id, ModerationStatus.EvidenceRequested, removeListing: false, "Reported listing moved to evidence review", cancellationToken);

    [HttpPost("moderation/{id}/dismiss")]
    [Authorize(Policy = Permissions.PlatformListingModerate)]
    public Task<ActionResult<ModerationCaseDto>> Dismiss(string id, CancellationToken cancellationToken) =>
        Resolve(id, ModerationStatus.Dismissed, removeListing: false, "Report dismissed", cancellationToken);

    [HttpPost("moderation/{id}/remove-listing")]
    [Authorize(Policy = Permissions.PlatformListingModerate)]
    public Task<ActionResult<ModerationCaseDto>> RemoveListing(string id, CancellationToken cancellationToken) =>
        Resolve(id, ModerationStatus.Removed, removeListing: true, "Reported listing removed", cancellationToken);

    private async Task<ActionResult<ModerationCaseDto>> Resolve(string id, ModerationStatus outcome, bool removeListing, string activity, CancellationToken cancellationToken)
    {
        var moderation = await db.ModerationCases.Include(candidate => candidate.Product).SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (moderation is null) return NotFound();
        if (!OpenStatuses.Contains(moderation.Status))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This case is already closed.");

        moderation.Status = outcome;
        if (outcome is ModerationStatus.Dismissed or ModerationStatus.Removed) moderation.ResolvedAt = time.GetUtcNow().UtcDateTime;
        if (removeListing && moderation.Product is { } product)
        {
            product.Status = ListingStatus.Inactive;
            product.RemovedByModeration = true;
        }

        Log($"{activity} ({moderation.Id})");
        await db.SaveChangesAsync(cancellationToken);
        return moderation.ToDto();
    }

    // ---- Helpers --------------------------------------------------------

    private static void Apply(Facility facility, UpsertFacilityRequest request)
    {
        facility.Name = request.Name.Trim();
        facility.Location = request.Location.Trim();
        facility.ResourceCount = request.ResourceCount;
        facility.ActiveBookings = request.ActiveBookings;
        facility.Status = request.Status!.Value;
    }

    private void Log(string description) =>
        db.ActivityLogs.Add(new ActivityLog { ActorId = User.UserId(), Description = description, At = time.GetUtcNow().UtcDateTime });
}
