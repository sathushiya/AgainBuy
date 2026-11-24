using System.Text.Json.Serialization;

namespace AgainBuy.Api.Domain;

/// <summary>
/// One buyer's purchase of one product from one seller, from reservation to
/// completion. Status only moves through OrdersController's actions, each of
/// which checks who may perform it.
/// </summary>
public class Order
{
    public required string Id { get; set; }
    public required string ProductId { get; set; }
    public Product? Product { get; set; }
    public required string BuyerId { get; set; }
    public User? Buyer { get; set; }
    public required string SellerId { get; set; }
    public User? Seller { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Negotiating;

    // Copied from the listing when it is reserved.
    public DeliveryOption DeliveryMethod { get; set; }
    public CourierService? Courier { get; set; }

    /// <summary>The price under negotiation; final once both parties agree.</summary>
    public decimal AgreedPrice { get; set; }
    public DateTime? BuyerAgreedAt { get; set; }
    public DateTime? SellerAgreedAt { get; set; }

    /// <summary>The seller's bank transfer details, copied when the deal is agreed.</summary>
    public string PaymentInstructions { get; set; } = "";
    public string PaymentReference { get; set; } = "";
    public DateTime? PaymentSubmittedAt { get; set; }
    public DateTime? PaymentConfirmedAt { get; set; }

    public string TrackingNumber { get; set; } = "";
    public string DeliveryNotes { get; set; } = "";
    /// <summary>When it was shipped, or marked ready for pickup.</summary>
    public DateTime? DispatchedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? DeliveryReceiptNumber { get; set; }

    /// <summary>The reservation date.</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>PostgreSQL xmin; stops two simultaneous actions both applying.</summary>
    public uint Version { get; set; }

    public List<OrderEvent> History { get; set; } = [];
}

/// <summary>One entry in an order's status history.</summary>
public class OrderEvent
{
    public int Id { get; set; }
    public required string OrderId { get; set; }
    public OrderStatus Status { get; set; }
    /// <summary>Who caused it; null for automatic steps.</summary>
    public string? ActorId { get; set; }
    public string Note { get; set; } = "";
    public DateTime At { get; set; } = DateTime.UtcNow;
}

/// <summary>A private file attached to an order, served only to its buyer and seller.</summary>
public class OrderFile
{
    public int Id { get; set; }
    public required string OrderId { get; set; }
    public OrderFileKind Kind { get; set; }
    public required string ContentType { get; set; }
    public required string FileName { get; set; }
    public required byte[] Data { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Notification
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public NotificationType Type { get; set; }
    public required string Title { get; set; }
    public string Body { get; set; } = "";
    public string? OrderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}

public enum OrderStatus
{
    Negotiating,
    [JsonStringEnumMemberName("Deal agreed")] DealAgreed,
    [JsonStringEnumMemberName("Payment pending")] PaymentPending,
    [JsonStringEnumMemberName("Payment verification pending")] PaymentVerificationPending,
    [JsonStringEnumMemberName("Payment confirmed")] PaymentConfirmed,
    Shipped,
    [JsonStringEnumMemberName("Ready for pickup")] ReadyForPickup,
    Delivered,
    Completed,
    Cancelled,
}

public enum OrderFileKind
{
    PaymentReceipt,
    DeliveryReceipt,
}

public enum NotificationType
{
    Reserved,
    ReservationCancelled,
    PriceChanged,
    DealAgreed,
    PaymentSubmitted,
    PaymentConfirmed,
    PaymentRejected,
    Shipped,
    ReadyForPickup,
    ReceiptGenerated,
    Delivered,
    Completed,
}
