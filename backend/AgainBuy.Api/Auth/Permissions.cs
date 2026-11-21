using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Auth;

// Server-side source of truth for frontend/src/config/permissions.ts. Every
// permission is registered as an authorization policy of the same name.
public static class Permissions
{
    public const string MarketplaceBrowse = "marketplace.browse";
    public const string ListingCreate = "listing.create";
    public const string ListingManageOwn = "listing.manage_own";
    public const string TransactionViewOwn = "transaction.view_own";
    public const string PlatformAnalytics = "platform.analytics";
    public const string PlatformUserManage = "platform.user_manage";
    public const string PlatformFacilityManage = "platform.facility_manage";
    public const string PlatformCategoryManage = "platform.category_manage";
    public const string PlatformListingModerate = "platform.listing_moderate";
    public const string PlatformSettings = "platform.settings";
    public const string ProfileManageOwn = "profile.manage_own";

    public static readonly IReadOnlyDictionary<UserRole, IReadOnlyList<string>> ByRole = new Dictionary<UserRole, IReadOnlyList<string>>
    {
        [UserRole.Customer] = [MarketplaceBrowse, ListingCreate, ListingManageOwn, TransactionViewOwn, ProfileManageOwn],
        [UserRole.Admin] = [PlatformAnalytics, PlatformUserManage, PlatformFacilityManage, PlatformCategoryManage, PlatformListingModerate, PlatformSettings, ProfileManageOwn],
    };

    public static IEnumerable<string> All => ByRole.Values.SelectMany(permissions => permissions).Distinct();

    public static IEnumerable<UserRole> RolesWith(string permission) =>
        ByRole.Where(entry => entry.Value.Contains(permission)).Select(entry => entry.Key);
}
