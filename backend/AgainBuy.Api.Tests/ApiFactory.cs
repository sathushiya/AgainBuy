using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgainBuy.Api.Assistant;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Images;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace AgainBuy.Api.Tests;

// One seeded PostgreSQL database per factory, so tests never see each other's
// writes. Uses the server from backend/docker-compose.yml unless
// AGAINBUY_TEST_DB points at another one.
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private const string DefaultServer = "Host=localhost;Port=5432;Username=againbuy;Password=againbuy_dev";

    private readonly string _connectionString = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("AGAINBUY_TEST_DB") ?? DefaultServer)
    {
        Database = $"againbuy_test_{Guid.NewGuid():N}",
    }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", _connectionString);
        builder.UseSetting("Jwt:Key", "integration-test-signing-key-0123456789abcdef");
        builder.UseSetting("Database:SeedDemoData", "true");
        builder.UseSetting("RateLimiting:AuthPermitPerMinute", "1000");
        builder.UseSetting("RateLimiting:AssistantPerMinute", "1000");
        if (CloudName is not null)
        {
            builder.UseSetting("Cloudinary:CloudName", CloudName);
            builder.UseSetting("Cloudinary:ApiKey", "test-key");
            builder.UseSetting("Cloudinary:ApiSecret", "test-secret");
        }
        // Never call the real Cloudinary or Groq from tests.
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IImageStorage>(Images);
            services.AddSingleton<IChatModel>(Chat);
        });
    }

    public FakeImageStorage Images { get; } = new();

    public FakeChatModel Chat { get; } = new();

    /// <summary>Set to simulate a server with Cloudinary credentials configured.</summary>
    public string? CloudName { get; init; }

    public async Task<HttpClient> SignedInClient(string email, string password)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var auth = (await response.Content.ReadFromJsonAsync<AuthResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);
        return client;
    }

    public Task<HttpClient> Customer() => SignedInClient(SeedData.CustomerEmail, SeedData.CustomerPassword);

    public Task<HttpClient> Admin() => SignedInClient(SeedData.AdminEmail, SeedData.AdminPassword);

    public override async ValueTask DisposeAsync()
    {
        await using (var scope = Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}

public static class HttpExtensions
{
    public static async Task<T> Read<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;
}
