using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/wishlist")]
[Authorize(Policy = Permissions.MarketplaceBrowse)]
public class WishlistController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> List(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var products = await db.WishlistItems.AsNoTracking()
            .Where(item => item.UserId == userId && item.Product!.Status != ListingStatus.Inactive)
            .OrderByDescending(item => item.AddedAt)
            .Select(item => item.Product!)
            .ToListAsync(cancellationToken);
        return products.Select(product => product.ToDto(userId)).ToList();
    }

    /// <summary>Product ids only, for cheaply rendering heart icons.</summary>
    [HttpGet("ids")]
    public async Task<ActionResult<IReadOnlyList<string>>> Ids(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        return await db.WishlistItems.AsNoTracking().Where(item => item.UserId == userId).Select(item => item.ProductId).ToListAsync(cancellationToken);
    }

    [HttpPut("{productId}")]
    public async Task<IActionResult> Add(string productId, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        if (!await db.Products.AnyAsync(product => product.Id == productId && product.Status != ListingStatus.Inactive, cancellationToken)) return NotFound();
        if (!await db.WishlistItems.AnyAsync(item => item.UserId == userId && item.ProductId == productId, cancellationToken))
        {
            db.WishlistItems.Add(new WishlistItem { UserId = userId, ProductId = productId });
            await db.SaveChangesAsync(cancellationToken);
        }
        return NoContent();
    }

    [HttpDelete("{productId}")]
    public async Task<IActionResult> Remove(string productId, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        await db.WishlistItems.Where(item => item.UserId == userId && item.ProductId == productId).ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }
}
