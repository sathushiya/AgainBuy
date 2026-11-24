using System.Security.Cryptography;
using AgainBuy.Api.Domain;
using Microsoft.AspNetCore.DataProtection;

namespace AgainBuy.Api.Orders;

/// <summary>
/// Short-lived signed links to an order's private files (payment receipts,
/// delivery receipts). Only the order's buyer or seller can request one, and
/// it stops working after a few minutes, so files are never publicly listed.
/// The link works without an Authorization header, which lets the app open
/// a PDF in the browser or show a receipt image directly.
/// </summary>
public class OrderFileLinks(IDataProtectionProvider protection, TimeProvider time)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);

    private readonly ITimeLimitedDataProtector _protector = protection.CreateProtector("AgainBuy.OrderFiles").ToTimeLimitedDataProtector();

    public (string Token, DateTime ExpiresAt) Create(string orderId, OrderFileKind kind)
    {
        var expiresAt = time.GetUtcNow().Add(Lifetime);
        return (_protector.Protect($"{orderId}|{kind}", expiresAt), expiresAt.UtcDateTime);
    }

    /// <summary>The order and file kind the token was issued for, or null if it's invalid or expired.</summary>
    public (string OrderId, OrderFileKind Kind)? Read(string token)
    {
        try
        {
            var parts = _protector.Unprotect(token).Split('|');
            return parts.Length == 2 && Enum.TryParse<OrderFileKind>(parts[1], out var kind) ? (parts[0], kind) : null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }
}
