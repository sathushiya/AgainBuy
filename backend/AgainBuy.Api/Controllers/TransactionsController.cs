using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

// No money moves through AgainBuy: a purchase reserves the listing and
// schedules a meetup; either party then completes or cancels it.
[ApiController]
[Route("api/transactions")]
[Authorize(Policy = Permissions.TransactionViewOwn)]
public class TransactionsController(AppDbContext db, TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TransactionDto>>> List([FromQuery] string? type, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var query = db.Transactions.AsNoTracking().Include(transaction => transaction.Product).Where(transaction => transaction.UserId == userId);

        if (!string.IsNullOrWhiteSpace(type))
        {
            if (!EnumNames.TryParse<TransactionType>(type, out var transactionType))
                return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["type"] = ["Use purchase or sale."] }));
            query = query.Where(transaction => transaction.Type == transactionType);
        }

        var transactions = await query.OrderByDescending(transaction => transaction.Date).ToListAsync(cancellationToken);
        return transactions.Select(transaction => transaction.ToDto()).ToList();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TransactionDto>> Get(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var transaction = await db.Transactions.AsNoTracking().Include(candidate => candidate.Product)
            .SingleOrDefaultAsync(candidate => candidate.Id == id && candidate.UserId == userId, cancellationToken);
        return transaction is null ? NotFound() : transaction.ToDto();
    }

    [HttpPost]
    public async Task<ActionResult<TransactionDto>> Purchase(PurchaseRequest request, CancellationToken cancellationToken)
    {
        var buyer = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (buyer is null) return Unauthorized();

        var product = await db.Products.SingleOrDefaultAsync(candidate => candidate.Id == request.ProductId, cancellationToken);
        if (product is null || product.Status == ListingStatus.Inactive) return NotFound();
        if (product.SellerId == buyer.Id)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You cannot buy your own listing.");

        await using var dbTransaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Conditional update so two buyers racing for the same item cannot both win.
        var reserved = await db.Products
            .Where(candidate => candidate.Id == product.Id && candidate.Status == ListingStatus.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.Status, ListingStatus.Reserved), cancellationToken);
        if (reserved == 0)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This item is no longer available.");

        var orderId = Ids.New("TX-");
        var now = time.GetUtcNow().UtcDateTime;
        var purchase = new Transaction
        {
            Id = orderId, OrderId = orderId, UserId = buyer.Id, ProductId = product.Id, Product = product, Type = TransactionType.Purchase,
            Party = product.SellerName, Amount = product.Price, Date = now, Status = TransactionStatus.MeetupScheduled,
        };
        db.Transactions.Add(purchase);

        if (product.SellerId is not null)
        {
            db.Transactions.Add(new Transaction
            {
                Id = Ids.New("TX-"), OrderId = orderId, UserId = product.SellerId, ProductId = product.Id, Type = TransactionType.Sale,
                Party = buyer.Name, Amount = product.Price, Date = now, Status = TransactionStatus.MeetupScheduled,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await dbTransaction.CommitAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = purchase.Id }, purchase.ToDto());
    }

    [HttpPost("{id}/complete")]
    public Task<ActionResult<TransactionDto>> Complete(string id, CancellationToken cancellationToken) =>
        Settle(id, TransactionStatus.Completed, ListingStatus.Sold, cancellationToken);

    [HttpPost("{id}/cancel")]
    public Task<ActionResult<TransactionDto>> Cancel(string id, CancellationToken cancellationToken) =>
        Settle(id, TransactionStatus.Cancelled, ListingStatus.Active, cancellationToken);

    private async Task<ActionResult<TransactionDto>> Settle(string id, TransactionStatus outcome, ListingStatus listingOutcome, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var mine = await db.Transactions.Include(transaction => transaction.Product)
            .SingleOrDefaultAsync(transaction => transaction.Id == id && transaction.UserId == userId, cancellationToken);
        if (mine is null) return NotFound();
        if (mine.Status != TransactionStatus.MeetupScheduled)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: $"This transaction is already {mine.Status.ToString().ToLowerInvariant()}.");

        var order = await db.Transactions.Where(transaction => transaction.OrderId == mine.OrderId).ToListAsync(cancellationToken);
        foreach (var transaction in order) transaction.Status = outcome;

        // A cancelled sale goes back on the market unless the seller pulled it meanwhile.
        if (mine.Product is { } product && product.Status == ListingStatus.Reserved) product.Status = listingOutcome;

        await db.SaveChangesAsync(cancellationToken);
        return mine.ToDto();
    }
}
