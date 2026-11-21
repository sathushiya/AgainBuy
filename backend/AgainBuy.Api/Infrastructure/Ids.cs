using System.Security.Cryptography;

namespace AgainBuy.Api.Infrastructure;

public static class Ids
{
    // Short, URL-safe, prefixed ids that sit comfortably next to the seeded
    // ones ("p1", "TX-2041", "MOD-41").
    public static string New(string prefix) => $"{prefix}{RandomNumberGenerator.GetHexString(12, lowercase: true)}";
}
