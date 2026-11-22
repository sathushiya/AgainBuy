namespace AgainBuy.Api.Domain;

public class User
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string PasswordHash { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.Customer;
    public AccountStatus Status { get; set; } = AccountStatus.Active;
    public string Avatar { get; set; } = "";
    public string Location { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Notification preferences, edited from Settings & Help.
    public bool NotifyMessages { get; set; } = true;
    public bool NotifyOrders { get; set; } = true;
    public bool NotifyNews { get; set; }

    // Pickup spots the user reuses when listing items; the first is the default.
    public List<string> SavedLocations { get; set; } = [];
}

public class Category
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public int SortOrder { get; set; }
}

public class Product
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public required string Category { get; set; }
    public decimal Price { get; set; }
    public decimal? OriginalPrice { get; set; }
    public string Image { get; set; } = "";
    public List<string> Images { get; set; } = [];
    public ProductCondition Condition { get; set; }
    public string Usage { get; set; } = "";
    public int PurchaseYear { get; set; }
    public string Location { get; set; } = "";

    // Seeded marketplace listings belong to sellers without accounts, so the
    // seller's display details are stored on the listing itself.
    public string? SellerId { get; set; }
    public User? SellerUser { get; set; }
    public required string SellerName { get; set; }
    public string SellerAvatar { get; set; } = "";
    public double SellerRating { get; set; }

    public string Brand { get; set; } = "";
    public string Model { get; set; } = "";
    public string Description { get; set; } = "";
    public string Defects { get; set; } = "";
    public string Accessories { get; set; } = "";
    public DateTime ListedAt { get; set; } = DateTime.UtcNow;
    public ListingStatus Status { get; set; } = ListingStatus.Active;

    // Set when a moderator takes the listing down; the seller cannot relist it.
    public bool RemovedByModeration { get; set; }
}

public class WishlistItem
{
    public required string UserId { get; set; }
    public required string ProductId { get; set; }
    public Product? Product { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

public class Conversation
{
    public required string Id { get; set; }
    public required string ProductId { get; set; }
    public Product? Product { get; set; }
    public required string BuyerId { get; set; }
    public User? Buyer { get; set; }
    public List<Message> Messages { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Message
{
    public int Id { get; set; }
    public required string ConversationId { get; set; }

    // Null when the sender is a seller without an account (seeded data).
    public string? SenderId { get; set; }
    public required string SenderName { get; set; }
    public required string Body { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}

public class Transaction
{
    public required string Id { get; set; }

    // Links the buyer's purchase record to the seller's sale record.
    public required string OrderId { get; set; }
    public required string UserId { get; set; }
    public required string ProductId { get; set; }
    public Product? Product { get; set; }
    public TransactionType Type { get; set; }
    public required string Party { get; set; }
    public decimal Amount { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public TransactionStatus Status { get; set; }
}

public class Facility
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public int ResourceCount { get; set; }
    public int ActiveBookings { get; set; }
    public FacilityStatus Status { get; set; } = FacilityStatus.Operational;
}

public class ModerationCase
{
    public required string Id { get; set; }
    public string? ProductId { get; set; }
    public Product? Product { get; set; }
    public required string Title { get; set; }
    public required string Reason { get; set; }
    public required string Seller { get; set; }
    public string? ReportedById { get; set; }
    public ModerationStatus Status { get; set; } = ModerationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
}

public class ActivityLog
{
    public int Id { get; set; }
    public required string ActorId { get; set; }
    public required string Description { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}

public class SupportTicket
{
    public required string Id { get; set; }
    public required string UserId { get; set; }
    public SupportTicketType Type { get; set; }
    public required string Subject { get; set; }
    public required string Message { get; set; }
    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.Open;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
