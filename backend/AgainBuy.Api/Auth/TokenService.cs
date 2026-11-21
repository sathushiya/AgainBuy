using System.Security.Claims;
using System.Text;
using AgainBuy.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AgainBuy.Api.Auth;

public static class AppClaims
{
    public const string Subject = JwtRegisteredClaimNames.Sub;
    public const string Name = "name";
    public const string Email = JwtRegisteredClaimNames.Email;
    public const string Role = "role";
}

public class TokenService(IOptions<JwtOptions> options, TimeProvider time)
{
    private readonly JsonWebTokenHandler _handler = new();

    public (string Token, DateTime ExpiresAt) Issue(User user)
    {
        var jwt = options.Value;
        var expiresAt = time.GetUtcNow().UtcDateTime.AddMinutes(jwt.LifetimeMinutes);
        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(
            [
                new Claim(AppClaims.Subject, user.Id),
                new Claim(AppClaims.Name, user.Name),
                new Claim(AppClaims.Email, user.Email),
                new Claim(AppClaims.Role, RoleName(user.Role)),
            ]),
            SigningCredentials = new SigningCredentials(SigningKey(jwt), SecurityAlgorithms.HmacSha256),
        });
        return (token, expiresAt);
    }

    public static SymmetricSecurityKey SigningKey(JwtOptions jwt) => new(Encoding.UTF8.GetBytes(jwt.Key));

    public static string RoleName(UserRole role) => role switch
    {
        UserRole.Customer => "customer",
        UserRole.Admin => "admin",
        _ => throw new ArgumentOutOfRangeException(nameof(role)),
    };
}

public static class ClaimsPrincipalExtensions
{
    public static string UserId(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(AppClaims.Subject) ?? throw new InvalidOperationException("Authenticated principal has no subject claim.");
}
