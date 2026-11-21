using AgainBuy.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Data;

// Mirrors the fixtures in frontend/src/data so the mobile app sees the same
// marketplace once it switches from mock data to the API.
public static class SeedData
{
    public const string CustomerId = "customer_1";
    public const string AdminId = "admin_1";
    public const string CustomerEmail = "customer@againbuy.demo";
    public const string CustomerPassword = "Customer123!";
    public const string AdminEmail = "admin@againbuy.demo";
    public const string AdminPassword = "Admin123!";

    // A second customer, for trying buyer/seller flows between two accounts.
    public const string DemoBuyerEmail = "demo@againbuy.demo";
    public const string DemoBuyerPassword = "Demo1234!";

    private const string SellerAvatar = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80";

    public static async Task SeedAsync(AppDbContext db, IPasswordHasher<User> hasher, CancellationToken cancellationToken = default)
    {
        if (await db.Users.AnyAsync(cancellationToken)) return;

        var now = DateTime.UtcNow;

        var customer = new User
        {
            Id = CustomerId,
            Name = "Maya Perera",
            Email = CustomerEmail,
            Role = UserRole.Customer,
            Avatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80",
            Location = "Colombo 05",
            CreatedAt = new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        var admin = new User
        {
            Id = AdminId,
            Name = "Arun Jayawardena",
            Email = AdminEmail,
            Role = UserRole.Admin,
            Avatar = "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=240&q=80",
            Location = "AgainBuy Platform",
            CreatedAt = new DateTime(2022, 9, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        var demoBuyer = new User
        {
            Id = "demo_buyer",
            Name = "Demo Buyer",
            Email = DemoBuyerEmail,
            Role = UserRole.Customer,
            Avatar = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=240&q=80",
            Location = "Nugegoda",
            CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        customer.PasswordHash = hasher.HashPassword(customer, CustomerPassword);
        admin.PasswordHash = hasher.HashPassword(admin, AdminPassword);
        demoBuyer.PasswordHash = hasher.HashPassword(demoBuyer, DemoBuyerPassword);

        // Non-demo accounts cannot sign in: they get a random, discarded password.
        User Extra(string id, string name, string email, AccountStatus status, DateTime createdAt)
        {
            var user = new User { Id = id, Name = name, Email = email, Status = status, CreatedAt = createdAt };
            user.PasswordHash = hasher.HashPassword(user, Guid.NewGuid().ToString("N"));
            return user;
        }

        db.Users.AddRange(
            customer,
            admin,
            demoBuyer,
            Extra("user_sanjana", "Sanjana Rodrigo", "sanjana@example.com", AccountStatus.Review, new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc)),
            Extra("user_ruwan", "Ruwan Jayasekara", "ruwan@example.com", AccountStatus.Inactive, new DateTime(2024, 4, 1, 0, 0, 0, DateTimeKind.Utc)));

        string[] categories = ["Phones", "Laptops", "Furniture", "Electronics", "Books", "Clothing", "Sports", "Appliances"];
        db.Categories.AddRange(categories.Select((name, index) => new Category { Name = name, SortOrder = index }));

        Product Listing(string id, string title, string category, decimal price, decimal? originalPrice, string image, ProductCondition condition,
            string usage, int year, string location, string seller, double rating, string brand, string model, string description,
            string defects, string accessories, TimeSpan age, ListingStatus status = ListingStatus.Active) => new()
            {
                Id = id, Title = title, Category = category, Price = price, OriginalPrice = originalPrice, Image = image, Images = [image],
                Condition = condition, Usage = usage, PurchaseYear = year, Location = location, SellerName = seller, SellerAvatar = SellerAvatar,
                SellerRating = rating, Brand = brand, Model = model, Description = description, Defects = defects, Accessories = accessories,
                ListedAt = now - age, Status = status,
            };

        var products = new[]
        {
            Listing("p1", "iPhone 13 · 128GB", "Phones", 138000, 229000, "https://images.unsplash.com/photo-1559041891-4da9154178aa?auto=format&fit=crop&w=900&q=85", ProductCondition.Excellent, "1 year 8 months", 2023, "Colombo 03", "Nimal S.", 4.9, "Apple", "iPhone 13", "Carefully used personal phone with strong battery health. Always kept in a case with a screen protector.", "Small mark near the charging port. No screen damage.", "Original box, cable, two cases", TimeSpan.FromMinutes(12)),
            Listing("p2", "MacBook Air M1", "Laptops", 185000, 285000, "https://images.unsplash.com/photo-1426024084828-5da21e13f5dc?auto=format&fit=crop&w=900&q=85", ProductCondition.Good, "2 years", 2022, "Nugegoda", "Sanjana R.", 4.8, "Apple", "MacBook Air M1", "Reliable laptop used for university work. Battery and keyboard are in good working order.", "Light scratches on the underside.", "Original charger", TimeSpan.FromHours(1)),
            Listing("p3", "Solid Teak Lounge Chair", "Furniture", 32000, 52000, "https://images.unsplash.com/photo-1782177387512-5c23069812e0?auto=format&fit=crop&w=900&q=85", ProductCondition.LikeNew, "8 months", 2024, "Kotte", "Amaya Home", 4.7, "Local craft", "Lounge 02", "Handmade teak chair in excellent condition. Selling due to relocation.", "None visible.", "Seat cushion included", TimeSpan.FromHours(3)),
            Listing("p4", "Fujifilm Compact Camera", "Electronics", 46500, 78000, "https://images.unsplash.com/photo-1564819337720-5d2f6803161c?auto=format&fit=crop&w=900&q=85", ProductCondition.Good, "3 years", 2021, "Dehiwala", "Kasun D.", 4.6, "Fujifilm", "XQ2", "Compact everyday camera with a bright lens and good image quality.", "Minor wear around mode dial.", "Battery, charger, wrist strap", TimeSpan.FromDays(1), ListingStatus.Reserved),
            Listing("p5", "Sony Wireless Headphones", "Electronics", 28500, 49000, "https://images.unsplash.com/photo-1714317437446-3ccdaf33eeea?auto=format&fit=crop&w=900&q=85", ProductCondition.Excellent, "10 months", 2024, "Rajagiriya", "Thilini P.", 5, "Sony", "WH-1000XM4", "Comfortable noise-cancelling headphones, lightly used.", "No known defects.", "Carry case and charging cable", TimeSpan.FromDays(2)),
            Listing("p6", "Architecture Book Set", "Books", 7200, 18000, "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=85", ProductCondition.Good, "4 years", 2020, "Moratuwa", "Ishara W.", 4.8, "Mixed publishers", "6-book set", "Six useful architecture references, ideal for students.", "Some pencil notes and shelf wear.", "Complete set of six", TimeSpan.FromDays(3)),
            Listing("p7", "Nike Running Shoes", "Clothing", 12500, 26000, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", ProductCondition.Good, "6 months", 2024, "Battaramulla", "Ravin K.", 4.5, "Nike", "Pegasus 40", "Comfortable daily trainers, UK size 9.", "Normal sole wear.", "Original box", TimeSpan.FromDays(4)),
            Listing("p8", "Rice Cooker · 1.8L", "Appliances", 9800, 18500, "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=900&q=85", ProductCondition.Excellent, "1 year", 2023, "Mount Lavinia", "Dinuki A.", 4.9, "Panasonic", "SR-W18", "Clean and fully working family-size rice cooker.", "Small cosmetic mark on lid.", "Measuring cup and spoon", TimeSpan.FromDays(7)),
        };
        db.Products.AddRange(products);

        // The customer's own listing, matching "mine_1" in AppContext.
        var headphones = products[4];
        var mine = Listing("mine_1", headphones.Title, headphones.Category, headphones.Price, headphones.OriginalPrice, headphones.Image,
            headphones.Condition, headphones.Usage, headphones.PurchaseYear, customer.Location, customer.Name, 4.9, headphones.Brand,
            headphones.Model, headphones.Description, headphones.Defects, headphones.Accessories, TimeSpan.FromDays(5));
        mine.SellerId = customer.Id;
        mine.SellerAvatar = customer.Avatar;
        db.Products.Add(mine);

        db.WishlistItems.AddRange(
            new WishlistItem { UserId = CustomerId, ProductId = "p1" },
            new WishlistItem { UserId = CustomerId, ProductId = "p3" });

        Conversation Thread(string id, Product product, params (bool fromSeller, string body, TimeSpan ago, bool read)[] messages) => new()
        {
            Id = id,
            ProductId = product.Id,
            BuyerId = CustomerId,
            CreatedAt = now - messages[0].ago,
            Messages = messages.Select(message => new Message
            {
                ConversationId = id,
                SenderId = message.fromSeller ? null : CustomerId,
                SenderName = message.fromSeller ? product.SellerName : customer.Name,
                Body = message.body,
                SentAt = now - message.ago,
                ReadAt = message.read ? now - message.ago : null,
            }).ToList(),
        };

        db.Conversations.AddRange(
            Thread("c1", products[0],
                (false, "Hi! Is the iPhone still available? Could I see it today?", TimeSpan.FromHours(2), true),
                (true, "Hello Maya, yes it is available.", TimeSpan.FromMinutes(50), false),
                (true, "Yes, you can inspect it this evening.", TimeSpan.FromMinutes(45), false)),
            Thread("c2", products[2],
                (false, "Do you deliver the chair?", TimeSpan.FromDays(1.2), true),
                (true, "Delivery within Colombo is possible.", TimeSpan.FromDays(1), true)),
            Thread("c3", products[4],
                (false, "How long does the battery last?", TimeSpan.FromDays(3.1), true),
                (true, "The battery lasts around 25 hours.", TimeSpan.FromDays(3), true)));

        db.Transactions.AddRange(
            new Transaction { Id = "TX-2041", OrderId = "TX-2041", UserId = CustomerId, ProductId = "p4", Type = TransactionType.Purchase, Party = "Kasun D.", Amount = 46500, Date = Utc(2025, 6, 12), Status = TransactionStatus.MeetupScheduled },
            new Transaction { Id = "TX-1984", OrderId = "TX-1984", UserId = CustomerId, ProductId = "p6", Type = TransactionType.Purchase, Party = "Ishara W.", Amount = 7200, Date = Utc(2025, 5, 28), Status = TransactionStatus.Completed },
            new Transaction { Id = "TX-2012", OrderId = "TX-2012", UserId = CustomerId, ProductId = "p2", Type = TransactionType.Sale, Party = "Harini F.", Amount = 174000, Date = Utc(2025, 6, 5), Status = TransactionStatus.Completed },
            new Transaction { Id = "TX-1892", OrderId = "TX-1892", UserId = CustomerId, ProductId = "p7", Type = TransactionType.Sale, Party = "Kavindu M.", Amount = 11000, Date = Utc(2025, 4, 18), Status = TransactionStatus.Completed });

        db.Facilities.AddRange(
            new Facility { Id = "fac_1", Name = "Colombo Community Hub", Location = "Colombo 07", ResourceCount = 28, ActiveBookings = 7, Status = FacilityStatus.Operational },
            new Facility { Id = "fac_2", Name = "North Campus Store", Location = "Kelaniya", ResourceCount = 19, ActiveBookings = 4, Status = FacilityStatus.Limited },
            new Facility { Id = "fac_3", Name = "Galle Circular Centre", Location = "Galle Fort", ResourceCount = 34, ActiveBookings = 9, Status = FacilityStatus.Operational });

        db.ModerationCases.AddRange(
            new ModerationCase { Id = "MOD-41", Title = "iPhone 14 Pro", Reason = "Possible counterfeit", Seller = "New account", Status = ModerationStatus.Pending, CreatedAt = now.AddHours(-5) },
            new ModerationCase { Id = "MOD-38", Title = "Designer Handbag", Reason = "Misleading condition", Seller = "D. Kumari", Status = ModerationStatus.EvidenceRequested, CreatedAt = now.AddDays(-1) },
            new ModerationCase { Id = "MOD-35", Title = "Prescription Item", Reason = "Prohibited category", Seller = "Removed user", Status = ModerationStatus.Urgent, CreatedAt = now.AddDays(-2) });

        db.ActivityLogs.AddRange(
            new ActivityLog { ActorId = AdminId, Description = "Facility record updated", At = now.AddMinutes(-12) },
            new ActivityLog { ActorId = AdminId, Description = "Electronics category policy updated", At = now.AddHours(-2) },
            new ActivityLog { ActorId = AdminId, Description = "Reported listing moved to evidence review", At = now.AddDays(-1) });

        await db.SaveChangesAsync(cancellationToken);
    }

    private static DateTime Utc(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);
}
