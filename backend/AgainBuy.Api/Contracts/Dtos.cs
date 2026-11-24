using System.ComponentModel.DataAnnotations;
using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Contracts;

// Response shapes follow frontend/src/types/index.ts. Timestamps are ISO-8601
// UTC; the app formats relative times ("12 min ago") itself.

public record UserDto(string Id, string Name, string Email, UserRole Role, string Avatar, string Location, string MemberSince, IReadOnlyList<string> Permissions);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8, ErrorMessage = "Use at least 8 characters.")] string Password);

public record RegisterRequest(
    [Required, MinLength(2, ErrorMessage = "Enter your full name."), MaxLength(120)] string Name,
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MinLength(8, ErrorMessage = "Use at least 8 characters."), MaxLength(128)] string Password);

public record ForgotPasswordRequest([Required, EmailAddress] string Email);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8, ErrorMessage = "Use at least 8 characters."), MaxLength(128)] string NewPassword);

public record AccountSettingsDto(bool NotifyMessages, bool NotifyOrders, bool NotifyNews, IReadOnlyList<string> SavedLocations);

public record UpdateAccountSettingsRequest(bool NotifyMessages, bool NotifyOrders, bool NotifyNews, [Required] IReadOnlyList<string> SavedLocations);

public record UpdateProfileRequest(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [MaxLength(120)] string? Location,
    [Url, MaxLength(2048)] string? Avatar);

public record ProductDto(
    string Id, string Title, string Category, decimal Price, decimal? OriginalPrice, string Image, IReadOnlyList<string> Images,
    ProductCondition Condition, string Usage, int PurchaseYear, string Location, string Seller, string SellerAvatar, double SellerRating,
    string Brand, string Model, string Description, string Defects, string Accessories, string ReasonForSelling, DeliveryOption Delivery,
    IReadOnlyList<ProductSpecification> Specifications, DateTime ListedAt, ListingStatus Status, bool IsOwn);

// Mirrors the Sell screen's zod schema in frontend/src/screens/sell/SellScreen.tsx.
public record UpsertListingRequest(
    [Required, MinLength(5, ErrorMessage = "Add a clear product title."), MaxLength(120)] string Title,
    [Required, MaxLength(60)] string Category,
    [Range(1, 100_000_000, ErrorMessage = "Enter a valid selling price.")] decimal Price,
    [Range(1, 100_000_000)] decimal? OriginalPrice,
    [Required] ProductCondition? Condition,
    // Optional: not every category has them (books have neither, furniture has no model).
    [MaxLength(80)] string? Brand,
    [MaxLength(80)] string? Model,
    [Required, MinLength(2, ErrorMessage = "Add how long it was used."), MaxLength(60)] string Usage,
    [Range(1950, 2100, ErrorMessage = "Enter a four-digit year.")] int PurchaseYear,
    [Required, MinLength(20, ErrorMessage = "Add at least 20 characters."), MaxLength(4000)] string Description,
    [Required, MinLength(2, ErrorMessage = "Describe defects or write \"None\"."), MaxLength(1000)] string Defects,
    [MaxLength(500)] string? Accessories,
    [MaxLength(300, ErrorMessage = "Keep the reason under 300 characters.")] string? ReasonForSelling,
    // Optional for older clients; a missing value means meet-up only.
    DeliveryOption? Delivery,
    // Category-specific details from the app's second Sell step.
    [MaxLength(40, ErrorMessage = "Too many details; keep it to 40.")] IReadOnlyList<SpecificationInput>? Specifications,
    [Required, MinLength(2, ErrorMessage = "Add a pickup location."), MaxLength(120)] string Location,
    [MaxLength(8)] IReadOnlyList<string>? Images);

public record SpecificationInput(
    [Required, MaxLength(40)] string Key,
    [Required, MaxLength(60)] string Label,
    // Blank values are allowed here and dropped when saving.
    [Required(AllowEmptyStrings = true), MaxLength(200, ErrorMessage = "Keep each detail under 200 characters.")] string Value);

public record ReportListingRequest([Required, MinLength(3), MaxLength(200)] string Reason);

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public record ConversationDto(string Id, string ProductId, string ProductTitle, string ProductImage, string Person, string Avatar, string LastMessage, DateTime Time, int Unread);

public record MessageDto(int Id, string SenderName, string Body, string? ImageUrl, DateTime SentAt, bool IsMine);

public record UnreadCountDto(int Count);

public record ConversationDetailDto(ConversationDto Conversation, IReadOnlyList<MessageDto> Messages);

// A message needs text, a photo, or both (checked in ConversationsController).
public record StartConversationRequest([Required] string ProductId, [MaxLength(2000)] string? Message, [MaxLength(2048)] string? ImageUrl);

public record SendMessageRequest([MaxLength(2000)] string? Body, [MaxLength(2048)] string? ImageUrl);

public record TransactionDto(string Id, string ProductId, string ProductTitle, string ProductImage, TransactionType Type, string Party, decimal Amount, DateTime Date, TransactionStatus Status);

public record PurchaseRequest([Required] string ProductId);

public record PlatformUserDto(string Id, string Name, string Email, UserRole Role, AccountStatus Status, DateTime Joined);

public record UpdateUserStatusRequest([Required] AccountStatus? Status);

public record UpdateUserRoleRequest([Required] UserRole? Role);

public record FacilityDto(string Id, string Name, string Location, int ResourceCount, int ActiveBookings, FacilityStatus Status);

public record UpsertFacilityRequest(
    [Required, MinLength(2), MaxLength(120)] string Name,
    [Required, MinLength(2), MaxLength(120)] string Location,
    [Range(0, 100_000)] int ResourceCount,
    [Range(0, 100_000)] int ActiveBookings,
    [Required] FacilityStatus? Status);

public record SupportTicketDto(string Id, SupportTicketType Type, string Subject, SupportTicketStatus Status, DateTime CreatedAt);

public record CreateSupportTicketRequest(
    [Required] SupportTicketType? Type,
    [Required, MinLength(3, ErrorMessage = "Add a short subject."), MaxLength(120)] string Subject,
    [Required, MinLength(10, ErrorMessage = "Describe it in at least 10 characters."), MaxLength(4000)] string Message);

public record CategoryDto(int Id, string Name);

public record CreateCategoryRequest([Required, MinLength(2), MaxLength(60)] string Name);

public record ModerationCaseDto(string Id, string? ProductId, string Title, string Reason, string Seller, ModerationStatus Status, DateTime CreatedAt);

public record ActivityDto(string Description, DateTime At);

public record AdminStatsDto(int TotalUsers, int ActiveCustomers, int Facilities, int ActiveListings, int PendingReviews, int ReportsAndFlags, IReadOnlyList<ActivityDto> RecentActivity);
