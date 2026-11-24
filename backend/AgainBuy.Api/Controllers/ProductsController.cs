using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Images;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize(Policy = Permissions.MarketplaceBrowse)]
public class ProductsController(AppDbContext db, IOptions<CloudinaryOptions> cloudinary) : ControllerBase
{
    private const int MaxPageSize = 50;

    /// <summary>Browse the marketplace. Inactive listings are never shown; sold ones only on request.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> List(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] string? condition,
        [FromQuery] string? status,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1) page = 1;
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Products.AsNoTracking().Where(product => product.Status != ListingStatus.Inactive);

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!EnumNames.TryParse<ListingStatus>(status, out var listingStatus) || listingStatus is ListingStatus.Inactive or ListingStatus.Reserved)
                return InvalidQuery(nameof(status), "Use Active or Sold.");
            query = query.Where(product => product.Status == listingStatus);
        }
        else
        {
            // Reserved items are hidden until the buyer completes or drops the reservation.
            query = query.Where(product => product.Status == ListingStatus.Active);
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(product => product.Category == category);

        if (!string.IsNullOrWhiteSpace(condition))
        {
            if (!EnumNames.TryParse<ProductCondition>(condition, out var productCondition))
                return InvalidQuery(nameof(condition), "Use Like new, Excellent, Good or Fair.");
            query = query.Where(product => product.Condition == productCondition);
        }

        if (minPrice is not null) query = query.Where(product => product.Price >= minPrice);
        if (maxPrice is not null) query = query.Where(product => product.Price <= maxPrice);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{EscapeLike(search.Trim())}%";
            query = query.Where(product =>
                EF.Functions.ILike(product.Title, pattern, "\\") ||
                EF.Functions.ILike(product.Brand, pattern, "\\") ||
                EF.Functions.ILike(product.Model, pattern, "\\") ||
                EF.Functions.ILike(product.Category, pattern, "\\"));
        }

        IOrderedQueryable<Product>? ordered = sort?.ToLowerInvariant() switch
        {
            "price_asc" => query.OrderBy(product => product.Price).ThenByDescending(product => product.ListedAt),
            "price_desc" => query.OrderByDescending(product => product.Price).ThenByDescending(product => product.ListedAt),
            null or "" or "newest" => query.OrderByDescending(product => product.ListedAt),
            _ => null,
        };
        if (ordered is null) return InvalidQuery(nameof(sort), "Use newest, price_asc or price_desc.");

        var total = await ordered.CountAsync(cancellationToken);
        var items = await ordered.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var viewerId = User.UserId();
        return new PagedResult<ProductDto>(items.Select(product => product.ToDto(viewerId)).ToList(), page, pageSize, total);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductDto>> Get(string id, CancellationToken cancellationToken)
    {
        var viewerId = User.UserId();
        var product = await db.Products.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (product is null || (product.Status == ListingStatus.Inactive && product.SellerId != viewerId)) return NotFound();
        var myOrderId = await db.Orders
            .Where(order => order.ProductId == id && order.Status != OrderStatus.Cancelled && (order.BuyerId == viewerId || order.SellerId == viewerId))
            .Select(order => order.Id).FirstOrDefaultAsync(cancellationToken);
        return product.ToDto(viewerId) with { MyOrderId = myOrderId };
    }

    [HttpGet("mine")]
    [Authorize(Policy = Permissions.ListingManageOwn)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Mine(CancellationToken cancellationToken)
    {
        var viewerId = User.UserId();
        var products = await db.Products.AsNoTracking()
            .Where(product => product.SellerId == viewerId)
            .OrderByDescending(product => product.ListedAt)
            .ToListAsync(cancellationToken);
        return products.Select(product => product.ToDto(viewerId)).ToList();
    }

    [HttpPost]
    [Authorize(Policy = Permissions.ListingCreate)]
    public async Task<ActionResult<ProductDto>> Create(UpsertListingRequest request, CancellationToken cancellationToken)
    {
        var seller = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (seller is null) return Unauthorized();
        if (await ValidateListing(request, cancellationToken) is { } problem) return problem;

        var product = new Product { Id = Ids.New("p_"), Title = "", Category = "", SellerId = seller.Id, SellerName = seller.Name, SellerAvatar = seller.Avatar };
        Apply(product, request);
        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = product.Id }, product.ToDto(seller.Id));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = Permissions.ListingManageOwn)]
    public async Task<ActionResult<ProductDto>> Update(string id, UpsertListingRequest request, CancellationToken cancellationToken)
    {
        var product = await FindOwn(id, cancellationToken);
        if (product is null) return NotFound();
        if (product.Status == ListingStatus.Sold || product.RemovedByModeration)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This listing can no longer be edited.");
        if (await ValidateListing(request, cancellationToken) is { } problem) return problem;

        Apply(product, request);
        await db.SaveChangesAsync(cancellationToken);
        return product.ToDto(product.SellerId);
    }

    [HttpPost("{id}/deactivate")]
    [Authorize(Policy = Permissions.ListingManageOwn)]
    public async Task<ActionResult<ProductDto>> Deactivate(string id, CancellationToken cancellationToken)
    {
        var product = await FindOwn(id, cancellationToken);
        if (product is null) return NotFound();
        if (product.Status == ListingStatus.Sold)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Sold listings cannot be deactivated.");
        if (product.Status == ListingStatus.Reserved)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This item is reserved. You can deactivate it once the buyer removes their reservation.");

        product.Status = ListingStatus.Inactive;
        await db.SaveChangesAsync(cancellationToken);
        return product.ToDto(product.SellerId);
    }

    [HttpPost("{id}/activate")]
    [Authorize(Policy = Permissions.ListingManageOwn)]
    public async Task<ActionResult<ProductDto>> Activate(string id, CancellationToken cancellationToken)
    {
        var product = await FindOwn(id, cancellationToken);
        if (product is null) return NotFound();
        if (product.Status != ListingStatus.Inactive || product.RemovedByModeration)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Only listings you deactivated can be reactivated.");

        product.Status = ListingStatus.Active;
        await db.SaveChangesAsync(cancellationToken);
        return product.ToDto(product.SellerId);
    }

    [HttpPost("{id}/report")]
    public async Task<ActionResult<ModerationCaseDto>> Report(string id, ReportListingRequest request, CancellationToken cancellationToken)
    {
        var reporterId = User.UserId();
        var product = await db.Products.SingleOrDefaultAsync(candidate => candidate.Id == id && candidate.Status != ListingStatus.Inactive, cancellationToken);
        if (product is null) return NotFound();
        if (product.SellerId == reporterId)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You cannot report your own listing.");

        var alreadyOpen = await db.ModerationCases.AnyAsync(moderation =>
            moderation.ProductId == id && moderation.ReportedById == reporterId &&
            moderation.Status != ModerationStatus.Dismissed && moderation.Status != ModerationStatus.Removed, cancellationToken);
        if (alreadyOpen)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "You have already reported this listing.");

        var moderation = new ModerationCase
        {
            Id = Ids.New("MOD-"),
            ProductId = product.Id,
            Title = product.Title,
            Reason = request.Reason.Trim(),
            Seller = product.SellerName,
            ReportedById = reporterId,
        };
        db.ModerationCases.Add(moderation);
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, moderation.ToDto());
    }

    private Task<Product?> FindOwn(string id, CancellationToken cancellationToken)
    {
        var sellerId = User.UserId();
        return db.Products.SingleOrDefaultAsync(product => product.Id == id && product.SellerId == sellerId, cancellationToken);
    }

    private async Task<ActionResult?> ValidateListing(UpsertListingRequest request, CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (!await db.Categories.AnyAsync(category => category.Name == request.Category, cancellationToken))
            errors["category"] = ["Choose one of the marketplace categories."];
        if (request.PurchaseYear > DateTime.UtcNow.Year)
            errors["purchaseYear"] = ["Purchase year cannot be in the future."];
        if (request.OriginalPrice is { } original && original < request.Price)
            errors["originalPrice"] = ["Original price should not be lower than the selling price."];
        if (request.Delivery == DeliveryOption.Delivery && request.Courier is null)
            errors["courier"] = ["Choose PickMe or Domex for delivery."];
        if (request.Images?.Any(image => !ImageUrls.IsAllowed(image, cloudinary.Value)) == true)
            errors["images"] = [cloudinary.Value.IsComplete ? "Upload photos through the app; outside image links are not allowed." : "Images must be absolute http(s) URLs."];

        return errors.Count == 0 ? null : ValidationProblem(new ValidationProblemDetails(errors));
    }

    private static void Apply(Product product, UpsertListingRequest request)
    {
        product.Title = request.Title.Trim();
        product.Category = request.Category;
        product.Price = request.Price;
        product.OriginalPrice = request.OriginalPrice;
        product.Condition = request.Condition!.Value;
        product.Brand = request.Brand?.Trim() ?? "";
        product.Model = request.Model?.Trim() ?? "";
        product.Usage = request.Usage.Trim();
        product.PurchaseYear = request.PurchaseYear;
        product.Description = request.Description.Trim();
        product.Defects = request.Defects.Trim();
        product.Accessories = request.Accessories?.Trim() ?? "";
        product.ReasonForSelling = request.ReasonForSelling?.Trim() ?? "";
        product.Delivery = request.Delivery ?? DeliveryOption.MeetUp;
        product.Courier = product.Delivery == DeliveryOption.Delivery ? request.Courier : null;
        // Keep the app's order; drop blank values and repeated keys.
        product.Specifications = (request.Specifications ?? [])
            .Select(specification => new ProductSpecification(specification.Key.Trim(), specification.Label.Trim(), specification.Value.Trim()))
            .Where(specification => specification.Key != "" && specification.Value != "")
            .DistinctBy(specification => specification.Key)
            .ToList();
        product.Location = request.Location.Trim();
        product.Images = request.Images?.ToList() ?? product.Images;
        product.Image = product.Images.FirstOrDefault() ?? product.Image;
    }

    private ActionResult InvalidQuery(string parameter, string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { [parameter] = [message] }));

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
