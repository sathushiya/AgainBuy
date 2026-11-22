using System.Text.Json.Serialization;

namespace AgainBuy.Api.Domain;

// JSON names mirror the string unions in frontend/src/types/index.ts so the
// mobile app can consume responses without remapping.

public enum UserRole
{
    [JsonStringEnumMemberName("customer")] Customer,
    [JsonStringEnumMemberName("admin")] Admin,
}

public enum AccountStatus
{
    Active,
    Review,
    Inactive,
}

public enum ProductCondition
{
    [JsonStringEnumMemberName("Like new")] LikeNew,
    Excellent,
    Good,
    Fair,
}

public enum ListingStatus
{
    Active,
    Reserved,
    Sold,
    Inactive,
}

public enum TransactionType
{
    [JsonStringEnumMemberName("purchase")] Purchase,
    [JsonStringEnumMemberName("sale")] Sale,
}

public enum TransactionStatus
{
    Completed,
    [JsonStringEnumMemberName("Meetup scheduled")] MeetupScheduled,
    Cancelled,
}

public enum FacilityStatus
{
    Operational,
    Limited,
    Maintenance,
}

public enum ModerationStatus
{
    Pending,
    [JsonStringEnumMemberName("Evidence requested")] EvidenceRequested,
    Urgent,
    Dismissed,
    Removed,
}

public enum SupportTicketType
{
    [JsonStringEnumMemberName("problem")] Problem,
    [JsonStringEnumMemberName("contact")] Contact,
}

public enum SupportTicketStatus
{
    Open,
    Closed,
}
