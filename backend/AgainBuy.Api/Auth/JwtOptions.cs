using System.ComponentModel.DataAnnotations;

namespace AgainBuy.Api.Auth;

public class JwtOptions
{
    public const string Section = "Jwt";

    [Required] public string Issuer { get; set; } = "";
    [Required] public string Audience { get; set; } = "";

    // HMAC-SHA256 needs at least 256 bits of key material.
    [Required, MinLength(32, ErrorMessage = "Jwt:Key must be at least 32 characters. Set it via configuration or the Jwt__Key environment variable.")]
    public string Key { get; set; } = "";

    [Range(5, 60 * 24 * 30)] public int LifetimeMinutes { get; set; } = 480;
}
