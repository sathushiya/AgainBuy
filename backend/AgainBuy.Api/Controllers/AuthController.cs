using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting(RateLimitPolicies.Auth)]
public class AuthController(AppDbContext db, IPasswordHasher<User> hasher, TokenService tokens, ILogger<AuthController> logger) : ControllerBase
{
    // Verifying against a throwaway hash when the email is unknown keeps the
    // response time from revealing which emails are registered.
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<User>().HashPassword(new User { Id = "", Name = "", Email = "" }, "dummy-password"));

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.SingleOrDefaultAsync(candidate => candidate.Email == email, cancellationToken);

        var result = hasher.VerifyHashedPassword(user ?? new User { Id = "", Name = "", Email = "" }, user?.PasswordHash ?? DummyHash.Value, request.Password);
        if (user is null || result == PasswordVerificationResult.Failed)
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Email or password is incorrect.");

        if (user.Status == AccountStatus.Inactive)
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "This account has been deactivated. Contact AgainBuy support.");

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, request.Password);
            await db.SaveChangesAsync(cancellationToken);
        }

        return Issue(user);
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        if (await db.Users.AnyAsync(user => user.Email == email, cancellationToken))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "An account with this email already exists.");

        // Self-registration always creates a customer; admins are promoted by other admins.
        var user = new User { Id = Ids.New("user_"), Name = request.Name.Trim(), Email = email, Role = UserRole.Customer };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, Issue(user));
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var exists = await db.Users.AnyAsync(user => user.Email == email, cancellationToken);

        // No mail provider is configured yet. Always answer the same way so the
        // endpoint cannot be used to discover registered emails.
        if (exists) logger.LogInformation("Password reset requested for user with email {Email}", email);
        return Accepted(new { message = "If an account exists for this email, reset instructions have been sent." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
    {
        var user = await db.Users.FindAsync([User.UserId()], cancellationToken);
        return user is null ? Unauthorized() : user.ToDto();
    }

    [Authorize(Policy = Permissions.ProfileManageOwn)]
    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (user is null) return Unauthorized();

        user.Name = request.Name.Trim();
        if (request.Location is not null) user.Location = request.Location.Trim();
        if (request.Avatar is not null) user.Avatar = request.Avatar.Trim();

        // Keep the seller details on this user's listings in step with the profile.
        await db.Products.Where(product => product.SellerId == user.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(product => product.SellerName, user.Name).SetProperty(product => product.SellerAvatar, user.Avatar), cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return user.ToDto();
    }

    [Authorize(Policy = Permissions.ProfileManageOwn)]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (user is null) return Unauthorized();

        if (hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["currentPassword"] = ["Current password is incorrect."] }));

        user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private AuthResponse Issue(User user)
    {
        var (token, expiresAt) = tokens.Issue(user);
        return new AuthResponse(token, expiresAt, user.ToDto());
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
