using AgainBuy.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Facility> Facilities => Set<Facility>();
    public DbSet<ModerationCase> ModerationCases => Set<ModerationCase>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        // Store enums by name so the database stays readable and reordering
        // enum members cannot corrupt existing rows.
        builder.Properties<Enum>().HaveConversion<string>();

        // LKR amounts up to 9,999,999,999.99. DateTimes need no convention:
        // Npgsql maps UTC DateTime to timestamptz and reads it back as UTC.
        builder.Properties<decimal>().HavePrecision(12, 2);
    }

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(entity =>
        {
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.Email).HasMaxLength(256);
            entity.Property(user => user.Name).HasMaxLength(120);
        });

        model.Entity<Category>().HasIndex(category => category.Name).IsUnique();

        model.Entity<Product>(entity =>
        {
            entity.HasOne(product => product.SellerUser).WithMany().HasForeignKey(product => product.SellerId).OnDelete(DeleteBehavior.SetNull);
            entity.HasIndex(product => product.Status);
            entity.HasIndex(product => product.Category);
            entity.HasIndex(product => product.SellerId);
        });

        model.Entity<WishlistItem>(entity =>
        {
            entity.HasKey(item => new { item.UserId, item.ProductId });
            entity.HasOne<User>().WithMany().HasForeignKey(item => item.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Product).WithMany().HasForeignKey(item => item.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Conversation>(entity =>
        {
            entity.HasOne(conversation => conversation.Product).WithMany().HasForeignKey(conversation => conversation.ProductId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(conversation => conversation.Buyer).WithMany().HasForeignKey(conversation => conversation.BuyerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(conversation => conversation.Messages).WithOne().HasForeignKey(message => message.ConversationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(conversation => new { conversation.ProductId, conversation.BuyerId }).IsUnique();
        });

        model.Entity<Message>().Property(message => message.Body).HasMaxLength(2000);

        model.Entity<Transaction>(entity =>
        {
            entity.HasOne<User>().WithMany().HasForeignKey(transaction => transaction.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(transaction => transaction.Product).WithMany().HasForeignKey(transaction => transaction.ProductId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(transaction => transaction.UserId);
            entity.HasIndex(transaction => transaction.OrderId);
        });

        model.Entity<ModerationCase>()
            .HasOne(moderation => moderation.Product).WithMany().HasForeignKey(moderation => moderation.ProductId).OnDelete(DeleteBehavior.SetNull);
    }
}
