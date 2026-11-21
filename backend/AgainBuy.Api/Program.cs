using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using AgainBuy.Api.Auth;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Images;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<TokenService>();

// Listing photos go to Cloudinary. Without credentials the API still runs;
// only the upload endpoint answers 503.
builder.Services.Configure<CloudinaryOptions>(builder.Configuration.GetSection(CloudinaryOptions.Section));
builder.Services.AddSingleton<IImageStorage, CloudinaryImageStorage>();

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = TokenService.SigningKey(jwt),
            NameClaimType = AppClaims.Name,
            RoleClaimType = AppClaims.Role,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
        options.Events = new JwtBearerEvents
        {
            // Tokens outlive account changes, so re-check the account on every
            // request: deactivated users and changed roles take effect at once.
            OnTokenValidated = async context =>
            {
                var userId = context.Principal?.FindFirst(AppClaims.Subject)?.Value;
                var role = context.Principal?.FindFirst(AppClaims.Role)?.Value;
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var account = userId is null ? null : await db.Users.AsNoTracking()
                    .Where(user => user.Id == userId)
                    .Select(user => new { user.Role, user.Status })
                    .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

                if (account is null || account.Status == AccountStatus.Inactive || TokenService.RoleName(account.Role) != role)
                    context.Fail("Account is no longer valid for this token.");
            },
        };
    });

builder.Services.AddAuthorization(options =>
{
    foreach (var permission in Permissions.All)
        options.AddPolicy(permission, policy => policy.RequireRole(Permissions.RolesWith(permission).Select(TokenService.RoleName)));
});

builder.Services.AddRateLimiter(options =>
{
    var permitPerMinute = builder.Configuration.GetValue("RateLimiting:AuthPermitPerMinute", 10);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(RateLimitPolicies.Auth, context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = permitPerMinute, Window = TimeSpan.FromMinutes(1) }));

    // Per signed-in user, to protect the Cloudinary quota.
    var uploadsPerMinute = builder.Configuration.GetValue("RateLimiting:UploadsPerMinute", 30);
    options.AddPolicy(RateLimitPolicies.Uploads, context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(AppClaims.Subject)?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = uploadsPerMinute, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    if (app.Configuration.GetValue<bool>("Database:SeedDemoData"))
        await SeedData.SeedAsync(db, scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>());
}

app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
else app.UseHsts();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

public partial class Program;
