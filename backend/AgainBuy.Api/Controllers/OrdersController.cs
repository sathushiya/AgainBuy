using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using AgainBuy.Api.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

/// <summary>
/// The purchase workflow: reserve → negotiate and agree → pay by bank
/// transfer → seller verifies → ship or ready for pickup → buyer confirms
/// delivery → completed. Every change is checked against OrderActions and
/// recorded in the order's history.
/// </summary>
[ApiController]
[Route("api/orders")]
[Authorize(Policy = Permissions.MarketplaceBrowse)]
public class OrdersController(AppDbContext db, Notifier notifier, TimeProvider time) : ControllerBase
{
    /// <summary>Reserves a listing: it leaves the marketplace and a negotiation starts with the seller.</summary>
    [HttpPost]
    public async Task<ActionResult<OrderDetailDto>> Reserve(ReserveRequest request, CancellationToken cancellationToken)
    {
        var buyer = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (buyer is null) return Unauthorized();

        var product = await db.Products.SingleOrDefaultAsync(candidate => candidate.Id == request.ProductId && candidate.Status != ListingStatus.Inactive, cancellationToken);
        if (product is null) return NotFound();
        if (product.SellerId == buyer.Id) return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You can't reserve your own listing.");
        if (product.SellerId is null)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This seller can't take reservations in the app yet. Chat with them instead.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Conditional update, so two buyers can't reserve the same item at once.
        var reserved = await db.Products
            .Where(candidate => candidate.Id == product.Id && candidate.Status == ListingStatus.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.Status, ListingStatus.Reserved), cancellationToken);
        if (reserved == 0) return Problem(statusCode: StatusCodes.Status409Conflict, title: "This item is no longer available.");

        var now = time.GetUtcNow().UtcDateTime;
        var order = new Order
        {
            Id = Ids.New("ORD-"),
            ProductId = product.Id,
            BuyerId = buyer.Id,
            SellerId = product.SellerId,
            DeliveryMethod = product.Delivery,
            Courier = product.Courier,
            AgreedPrice = product.Price,
            CreatedAt = now,
        };
        Move(order, OrderStatus.Negotiating, buyer.Id, "Reserved by the buyer");
        db.Orders.Add(order);
        await OpenConversation(product, buyer, now, cancellationToken);

        notifier.Send(product.SellerId, NotificationType.Reserved, "New reservation", $"{buyer.Name} reserved {product.Title}. Agree the price in chat, then confirm the deal.", order.Id);
        notifier.Send(buyer.Id, NotificationType.Reserved, "Product reserved", $"You reserved {product.Title}. It's hidden from other buyers while you discuss it with {product.SellerName}.", order.Id);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The one-live-order-per-product index caught a conflicting order.
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This item is no longer available.");
        }
        await transaction.CommitAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = order.Id }, await Detail(order.Id, buyer.Id, cancellationToken));
    }

    /// <summary>The user's orders as buyer ("my reservations and purchases") or as seller ("reserved by customers").</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderSummaryDto>>> List([FromQuery(Name = "as")] string? role, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        if (role is not ("buyer" or "seller"))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["as"] = ["Use buyer or seller."] }));

        var orders = await Orders()
            .Where(order => role == "buyer" ? order.BuyerId == userId : order.SellerId == userId)
            .OrderByDescending(order => order.UpdatedAt)
            .ToListAsync(cancellationToken);
        var withReceipts = await ReceiptOrderIds(orders.Select(order => order.Id), cancellationToken);
        return orders.Select(order => Summary(order, userId, withReceipts.Contains(order.Id))).ToList();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OrderDetailDto>> Get(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        if (!await db.Orders.AnyAsync(order => order.Id == id && (order.BuyerId == userId || order.SellerId == userId), cancellationToken)) return NotFound();
        return await Detail(id, userId, cancellationToken);
    }

    // ---- Helpers ------------------------------------------------------------

    private IQueryable<Order> Orders() =>
        db.Orders.Include(order => order.Product).Include(order => order.Buyer).Include(order => order.Seller).Include(order => order.History);

    /// <summary>The order, if the signed-in user is its buyer or seller.</summary>
    private Task<Order?> FindForParticipant(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        return Orders().SingleOrDefaultAsync(order => order.Id == id && (order.BuyerId == userId || order.SellerId == userId), cancellationToken);
    }

    /// <summary>Changes status and records it in the order's history.</summary>
    private void Move(Order order, OrderStatus status, string? actorId, string note = "")
    {
        var now = time.GetUtcNow().UtcDateTime;
        order.Status = status;
        order.UpdatedAt = now;
        order.History.Add(new OrderEvent { OrderId = order.Id, Status = status, ActorId = actorId, Note = note, At = now });
    }

    /// <summary>Checks the action against OrderActions; returns the error to send back, if any.</summary>
    private ActionResult? Disallowed(Order order, string action) =>
        OrderActions.Check(order, User.UserId(), action) is { } problem ? Problem(statusCode: problem.Status, title: problem.Message) : null;

    /// <summary>Saves, turning a concurrent change by the other party into a friendly conflict.</summary>
    private async Task<ActionResult?> Save(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "This order was just updated by the other party. Refresh and try again.");
        }
    }

    /// <summary>Makes sure buyer and seller have a conversation about the product, so either can reply.</summary>
    private async Task OpenConversation(Product product, User buyer, DateTime now, CancellationToken cancellationToken)
    {
        var conversation = await db.Conversations.SingleOrDefaultAsync(candidate => candidate.ProductId == product.Id && candidate.BuyerId == buyer.Id, cancellationToken);
        if (conversation is null)
        {
            conversation = new Conversation { Id = Ids.New("c_"), ProductId = product.Id, BuyerId = buyer.Id, CreatedAt = now };
            db.Conversations.Add(conversation);
        }
        db.Messages.Add(new Message { ConversationId = conversation.Id, SenderId = buyer.Id, SenderName = buyer.Name, Body = $"Hi! I've reserved {product.Title}. Let's agree the details here.", SentAt = now });
    }

    private async Task<HashSet<string>> ReceiptOrderIds(IEnumerable<string> orderIds, CancellationToken cancellationToken)
    {
        var ids = orderIds.ToList();
        return (await db.OrderFiles.Where(file => ids.Contains(file.OrderId) && file.Kind == OrderFileKind.DeliveryReceipt).Select(file => file.OrderId).ToListAsync(cancellationToken)).ToHashSet();
    }

    private static OrderPartyDto Party(User? user) => new(user?.Id ?? "", user?.Name ?? "", user?.Avatar ?? "", user?.Location ?? "");

    private static OrderSummaryDto Summary(Order order, string userId, bool hasDeliveryReceipt)
    {
        var isBuyer = order.BuyerId == userId;
        return new OrderSummaryDto(
            order.Id, order.ProductId, order.Product?.Title ?? "", order.Product?.Image ?? "", order.Status, isBuyer,
            Party(isBuyer ? order.Seller : order.Buyer), order.AgreedPrice, order.DeliveryMethod, order.Courier,
            order.CreatedAt, order.UpdatedAt, hasDeliveryReceipt);
    }

    private async Task<OrderDetailDto> Detail(string id, string userId, CancellationToken cancellationToken)
    {
        var order = await Orders().AsNoTracking().SingleAsync(candidate => candidate.Id == id, cancellationToken);
        var files = await db.OrderFiles.Where(file => file.OrderId == id).Select(file => file.Kind).ToListAsync(cancellationToken);
        var conversationId = await db.Conversations.Where(conversation => conversation.ProductId == order.ProductId && conversation.BuyerId == order.BuyerId).Select(conversation => conversation.Id).FirstOrDefaultAsync(cancellationToken);
        var names = new Dictionary<string, string> { [order.BuyerId] = order.Buyer?.Name ?? "Buyer", [order.SellerId] = order.Seller?.Name ?? "Seller" };
        var isBuyer = order.BuyerId == userId;

        return new OrderDetailDto(
            Summary(order, userId, files.Contains(OrderFileKind.DeliveryReceipt)), Party(order.Buyer), Party(order.Seller), order.Product?.Price ?? order.AgreedPrice,
            order.BuyerAgreedAt, order.SellerAgreedAt,
            // Bank details are only shown to the buyer once the deal is agreed.
            isBuyer && order.Status < OrderStatus.PaymentPending ? "" : order.PaymentInstructions,
            order.PaymentReference, order.PaymentSubmittedAt, order.PaymentConfirmedAt, files.Contains(OrderFileKind.PaymentReceipt),
            order.TrackingNumber, order.DeliveryNotes, order.DispatchedAt, order.DeliveredAt, order.CompletedAt, order.CancelledAt,
            order.DeliveryReceiptNumber, conversationId,
            order.History.OrderBy(change => change.At).ThenBy(change => change.Id)
                .Select(change => new OrderEventDto(change.Status, change.Note, change.At, change.ActorId is null ? null : names.GetValueOrDefault(change.ActorId)))
                .ToList(),
            OrderActions.For(order, userId));
    }
}
