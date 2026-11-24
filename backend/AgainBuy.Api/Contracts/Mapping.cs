using System.Globalization;
using AgainBuy.Api.Auth;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Contracts;

public static class Mapping
{
    public static UserDto ToDto(this User user) => new(
        user.Id, user.Name, user.Email, user.Role, user.Avatar, user.Location,
        user.CreatedAt.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
        Permissions.ByRole[user.Role]);

    public static AccountSettingsDto ToSettingsDto(this User user) =>
        new(user.NotifyMessages, user.NotifyOrders, user.NotifyNews, user.SavedLocations);

    public static ProductDto ToDto(this Product product, string? viewerId) => new(
        product.Id, product.Title, product.Category, product.Price, product.OriginalPrice, product.Image,
        product.Images.Count > 0 ? product.Images : [product.Image],
        product.Condition, product.Usage, product.PurchaseYear, product.Location, product.SellerName, product.SellerAvatar,
        product.SellerRating, product.Brand, product.Model, product.Description, product.Defects, product.Accessories, product.ReasonForSelling, product.Delivery,
        product.ListedAt, product.Status, viewerId is not null && product.SellerId == viewerId);

    public static TransactionDto ToDto(this Transaction transaction) => new(
        transaction.Id, transaction.ProductId, transaction.Product?.Title ?? "", transaction.Product?.Image ?? "",
        transaction.Type, transaction.Party, transaction.Amount, transaction.Date, transaction.Status);

    public static PlatformUserDto ToPlatformDto(this User user) => new(user.Id, user.Name, user.Email, user.Role, user.Status, user.CreatedAt);

    public static SupportTicketDto ToDto(this SupportTicket ticket) =>
        new(ticket.Id, ticket.Type, ticket.Subject, ticket.Status, ticket.CreatedAt);

    public static FacilityDto ToDto(this Facility facility) => new(
        facility.Id, facility.Name, facility.Location, facility.ResourceCount, facility.ActiveBookings, facility.Status);

    public static ModerationCaseDto ToDto(this ModerationCase moderation) => new(
        moderation.Id, moderation.ProductId, moderation.Title, moderation.Reason, moderation.Seller, moderation.Status, moderation.CreatedAt);
}
