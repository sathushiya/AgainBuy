using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

// Purchase and sale history. New purchases go through OrdersController
// (reserve → agree → pay → deliver), which adds rows here on completion.
// Complete and cancel remain for older meetup-scheduled records.
[ApiController]
[Route("api/transactions")]
[Authorize(Policy = Permissions.TransactionViewOwn)]
public class TransactionsController(AppDbContext db) : ControllerBase
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
