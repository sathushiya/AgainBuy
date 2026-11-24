using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using AgainBuy.Api.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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

    // ---- Stage 1–2: negotiate, agree, or drop the reservation -------------------

    /// <summary>Either party proposes a new price. Both agreements reset, since they were for the old price.</summary>
    [HttpPost("{id}/price")]
    public async Task<ActionResult<OrderDetailDto>> ProposePrice(string id, ProposePriceRequest request, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.ProposePrice) is { } refused) return refused;

        var userId = User.UserId();
        if (request.Price != order.AgreedPrice)
        {
            order.AgreedPrice = request.Price;
            order.BuyerAgreedAt = null;
            order.SellerAgreedAt = null;
            Move(order, OrderStatus.Negotiating, userId, $"Price changed to {Lkr(request.Price)}");
            notifier.Send(OtherParty(order, userId), NotificationType.PriceChanged, "New price proposed", $"{NameOf(order, userId)} proposed {Lkr(request.Price)} for {order.Product!.Title}.", order.Id);
            if (await Save(cancellationToken) is { } conflict) return conflict;
        }
        return await Detail(id, userId, cancellationToken);
    }

    /// <summary>
    /// Records this party's agreement to the current price. Once both have agreed
    /// the deal is final and the order waits for the buyer's bank transfer.
    /// </summary>
    [HttpPost("{id}/agree")]
    public async Task<ActionResult<OrderDetailDto>> Agree(string id, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.Agree) is { } refused) return refused;

        var userId = User.UserId();
        var isSeller = order.SellerId == userId;
        if (isSeller && string.IsNullOrWhiteSpace(order.Seller!.BankDetails))
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Add your bank transfer details in Settings & Help before agreeing, so the buyer knows where to pay.");

        var now = time.GetUtcNow().UtcDateTime;
        if (isSeller) order.SellerAgreedAt = now;
        else order.BuyerAgreedAt = now;
        Move(order, OrderStatus.Negotiating, userId, $"{NameOf(order, userId)} agreed to {Lkr(order.AgreedPrice)}");

        if (order.BuyerAgreedAt is not null && order.SellerAgreedAt is not null)
        {
            Move(order, OrderStatus.DealAgreed, userId, $"Both agreed to {Lkr(order.AgreedPrice)}");
            order.PaymentInstructions = order.Seller!.BankDetails;
            Move(order, OrderStatus.PaymentPending, null, "Waiting for the buyer's bank transfer");
            var title = order.Product!.Title;
            notifier.Send(order.BuyerId, NotificationType.DealAgreed, "Deal agreed", $"You and {order.Seller.Name} agreed {Lkr(order.AgreedPrice)} for {title}. Transfer the money using the seller's bank details, then upload your receipt.", order.Id);
            notifier.Send(order.SellerId, NotificationType.DealAgreed, "Deal agreed", $"You and {order.Buyer!.Name} agreed {Lkr(order.AgreedPrice)} for {title}. You'll be notified when they upload their payment receipt.", order.Id);
        }
        else
        {
            notifier.Send(OtherParty(order, userId), NotificationType.DealAgreed, "Waiting for you to agree", $"{NameOf(order, userId)} agreed to {Lkr(order.AgreedPrice)} for {order.Product!.Title}. Agree too to confirm the deal.", order.Id);
        }

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, userId, cancellationToken);
    }

    /// <summary>The buyer drops the reservation (before paying); the item goes back on the marketplace.</summary>
    [HttpPost("{id}/cancel")]
    public async Task<ActionResult<OrderDetailDto>> Cancel(string id, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.Cancel) is { } refused) return refused;

        order.CancelledAt = time.GetUtcNow().UtcDateTime;
        Move(order, OrderStatus.Cancelled, order.BuyerId, "Reservation removed by the buyer");
        if (order.Product!.Status == ListingStatus.Reserved) order.Product.Status = ListingStatus.Active;
        notifier.Send(order.SellerId, NotificationType.ReservationCancelled, "Reservation removed", $"{order.Buyer!.Name} removed their reservation for {order.Product.Title}. It's back on the marketplace.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    // ---- Stage 3–4: bank transfer and the seller's verification ---------------

    public const long MaxReceiptBytes = 5 * 1024 * 1024;

    /// <summary>
    /// The buyer uploads their bank transfer receipt (photo or PDF). This only
    /// asks the seller to check their account: it never confirms the payment.
    /// </summary>
    [HttpPost("{id}/payment-receipt")]
    [EnableRateLimiting(RateLimitPolicies.Uploads)]
    [RequestSizeLimit(MaxReceiptBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxReceiptBytes + 64 * 1024)]
    public async Task<ActionResult<OrderDetailDto>> UploadPaymentReceipt(string id, IFormFile? file, [FromForm] string? reference, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.UploadReceipt) is { } refused) return refused;
        if (file is null || file.Length == 0) return InvalidFile("Choose the receipt to upload.");
        if (file.Length > MaxReceiptBytes) return InvalidFile("Receipts must be 5 MB or smaller.");
        if (reference?.Trim().Length > 120) return InvalidFile("Keep the transfer reference under 120 characters.");

        await using var content = file.OpenReadStream();
        var contentType = await FileSignatures.DetectAsync(content, cancellationToken);
        if (contentType is null) return InvalidFile("Upload a photo or PDF of your bank transfer receipt.");
        content.Position = 0;
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy, cancellationToken);

        var now = time.GetUtcNow().UtcDateTime;
        await db.OrderFiles.Where(existing => existing.OrderId == id && existing.Kind == OrderFileKind.PaymentReceipt).ExecuteDeleteAsync(cancellationToken);
        db.OrderFiles.Add(new OrderFile
        {
            OrderId = id,
            Kind = OrderFileKind.PaymentReceipt,
            ContentType = contentType,
            FileName = $"payment-receipt-{id}{(contentType == FileSignatures.Pdf ? ".pdf" : "")}",
            Data = copy.ToArray(),
            CreatedAt = now,
        });

        var resubmitted = order.Status == OrderStatus.PaymentVerificationPending;
        order.PaymentReference = reference?.Trim() ?? "";
        order.PaymentSubmittedAt = now;
        Move(order, OrderStatus.PaymentVerificationPending, order.BuyerId, resubmitted ? "Payment receipt replaced" : "Payment receipt uploaded");
        notifier.Send(order.SellerId, NotificationType.PaymentSubmitted, "Payment receipt uploaded", $"{order.Buyer!.Name} uploaded a bank transfer receipt for {order.Product!.Title} ({Lkr(order.AgreedPrice)}). Check your bank account, then confirm the payment.", order.Id);
        notifier.Send(order.BuyerId, NotificationType.PaymentSubmitted, "Payment confirmation pending", $"Your receipt for {order.Product.Title} was sent. {order.Seller!.Name} will confirm once the money arrives.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    /// <summary>The seller confirms the money reached their account, after checking it themselves.</summary>
    [HttpPost("{id}/confirm-payment")]
    public async Task<ActionResult<OrderDetailDto>> ConfirmPayment(string id, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.ConfirmPayment) is { } refused) return refused;

        order.PaymentConfirmedAt = time.GetUtcNow().UtcDateTime;
        Move(order, OrderStatus.PaymentConfirmed, order.SellerId, "Payment confirmed by the seller");
        var next = order.DeliveryMethod == DeliveryOption.Delivery ? "They'll ship it and share the tracking number." : "They'll let you know when it's ready for pickup.";
        notifier.Send(order.BuyerId, NotificationType.PaymentConfirmed, "Payment confirmed", $"{order.Seller!.Name} confirmed your payment of {Lkr(order.AgreedPrice)} for {order.Product!.Title}. {next}", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    /// <summary>The seller hasn't received the money; the buyer is asked to check and upload again.</summary>
    [HttpPost("{id}/reject-payment")]
    public async Task<ActionResult<OrderDetailDto>> RejectPayment(string id, RejectPaymentRequest request, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.RejectPayment) is { } refused) return refused;

        order.PaymentSubmittedAt = null;
        var reason = request.Reason.Trim();
        Move(order, OrderStatus.PaymentPending, order.SellerId, $"Payment not received: {reason}");
        notifier.Send(order.BuyerId, NotificationType.PaymentRejected, "Payment not received yet", $"{order.Seller!.Name} couldn't find your payment for {order.Product!.Title}: \"{reason}\". Check the transfer and upload your receipt again.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    // ---- Stage 5–6: ship or hand over, then the buyer confirms receipt ---------

    /// <summary>The seller has booked the courier (on its own website) and records the shipment.</summary>
    [HttpPost("{id}/ship")]
    public async Task<ActionResult<OrderDetailDto>> Ship(string id, ShipRequest request, [FromServices] DeliveryReceiptPdf receipts, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.Ship) is { } refused) return refused;

        var courier = request.Courier ?? order.Courier;
        if (courier is null)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["courier"] = ["Choose PickMe or Domex."] }));

        order.Courier = courier;
        order.TrackingNumber = request.TrackingNumber.Trim();
        order.DeliveryNotes = request.DeliveryNotes?.Trim() ?? "";
        order.DispatchedAt = time.GetUtcNow().UtcDateTime;
        Move(order, OrderStatus.Shipped, order.SellerId, $"Shipped with {courier}, tracking number {order.TrackingNumber}");
        await WriteDeliveryReceipt(order, receipts, cancellationToken);

        var title = order.Product!.Title;
        notifier.Send(order.BuyerId, NotificationType.Shipped, "Your order has been shipped", $"{title} is on its way with {courier}. Tracking number: {order.TrackingNumber}. Track it on the {courier} website.", order.Id);
        notifier.Send(order.BuyerId, NotificationType.ReceiptGenerated, "Delivery receipt ready", $"Your delivery receipt {order.DeliveryReceiptNumber} for {title} is ready to download from the order.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    /// <summary>For pickup orders: the item is ready for the buyer to collect.</summary>
    [HttpPost("{id}/ready-for-pickup")]
    public async Task<ActionResult<OrderDetailDto>> ReadyForPickup(string id, ReadyForPickupRequest request, [FromServices] DeliveryReceiptPdf receipts, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.ReadyForPickup) is { } refused) return refused;

        order.DeliveryNotes = request.PickupNotes?.Trim() ?? "";
        order.DispatchedAt = time.GetUtcNow().UtcDateTime;
        Move(order, OrderStatus.ReadyForPickup, order.SellerId, "Ready for pickup");
        await WriteDeliveryReceipt(order, receipts, cancellationToken);

        var title = order.Product!.Title;
        notifier.Send(order.BuyerId, NotificationType.ReadyForPickup, "Ready for pickup", $"{title} is ready to collect from {order.Seller!.Name} in {order.Product.Location}. Arrange the time in chat.", order.Id);
        notifier.Send(order.BuyerId, NotificationType.ReceiptGenerated, "Pickup receipt ready", $"Your receipt {order.DeliveryReceiptNumber} for {title} is ready to download from the order.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    /// <summary>
    /// Only the buyer can say they've received the item. That completes the
    /// order: the listing is sold and both parties' histories are updated.
    /// </summary>
    [HttpPost("{id}/confirm-delivery")]
    public async Task<ActionResult<OrderDetailDto>> ConfirmDelivery(string id, [FromServices] DeliveryReceiptPdf receipts, CancellationToken cancellationToken)
    {
        var order = await FindForParticipant(id, cancellationToken);
        if (order is null) return NotFound();
        if (Disallowed(order, OrderActions.ConfirmDelivery) is { } refused) return refused;

        var now = time.GetUtcNow().UtcDateTime;
        order.DeliveredAt = now;
        Move(order, OrderStatus.Delivered, order.BuyerId, "Received by the buyer");
        order.CompletedAt = now;
        Move(order, OrderStatus.Completed, null, "Transaction completed");
        order.Product!.Status = ListingStatus.Sold;

        // Purchase and sales history (shown under My Purchases / My Sales).
        db.Transactions.Add(new Transaction { Id = Ids.New("TX-"), OrderId = order.Id, UserId = order.BuyerId, ProductId = order.ProductId, Type = TransactionType.Purchase, Party = order.Seller!.Name, Amount = order.AgreedPrice, Date = now, Status = TransactionStatus.Completed });
        db.Transactions.Add(new Transaction { Id = Ids.New("TX-"), OrderId = order.Id, UserId = order.SellerId, ProductId = order.ProductId, Type = TransactionType.Sale, Party = order.Buyer!.Name, Amount = order.AgreedPrice, Date = now, Status = TransactionStatus.Completed });

        // Refresh the receipt so it shows the delivery.
        await WriteDeliveryReceipt(order, receipts, cancellationToken);

        var title = order.Product.Title;
        notifier.Send(order.SellerId, NotificationType.Delivered, "Product delivered", $"{order.Buyer.Name} confirmed they received {title}.", order.Id);
        notifier.Send(order.SellerId, NotificationType.Completed, "Sale completed", $"Your sale of {title} for {Lkr(order.AgreedPrice)} is complete.", order.Id);
        notifier.Send(order.BuyerId, NotificationType.Completed, "Purchase completed", $"Thanks for confirming. Your purchase of {title} is complete.", order.Id);

        if (await Save(cancellationToken) is { } conflict) return conflict;
        return await Detail(id, User.UserId(), cancellationToken);
    }

    /// <summary>A short-lived link to the order's payment receipt or delivery receipt, for its buyer or seller only.</summary>
    [HttpGet("{id}/files/{kind}/link")]
    public async Task<ActionResult<FileLinkDto>> FileLink(string id, string kind, [FromServices] OrderFileLinks links, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        if (!await db.Orders.AnyAsync(order => order.Id == id && (order.BuyerId == userId || order.SellerId == userId), cancellationToken)) return NotFound();

        OrderFileKind? fileKind = kind switch { "payment-receipt" => OrderFileKind.PaymentReceipt, "delivery-receipt" => OrderFileKind.DeliveryReceipt, _ => null };
        if (fileKind is null || !await db.OrderFiles.AnyAsync(file => file.OrderId == id && file.Kind == fileKind, cancellationToken)) return NotFound();

        var (token, expiresAt) = links.Create(id, fileKind.Value);
        return new FileLinkDto($"/api/files/{Uri.EscapeDataString(token)}", expiresAt);
    }

    // ---- Helpers ------------------------------------------------------------

    /// <summary>Renders the delivery/pickup receipt from the order as it stands and stores it privately.</summary>
    private async Task WriteDeliveryReceipt(Order order, DeliveryReceiptPdf receipts, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow().UtcDateTime;
        order.DeliveryReceiptNumber ??= $"RCPT-{now:yyyyMMdd}-{System.Security.Cryptography.RandomNumberGenerator.GetHexString(6)}";
        var pdf = await receipts.RenderAsync(order, order.DeliveryReceiptNumber, now, cancellationToken);

        var file = await db.OrderFiles.SingleOrDefaultAsync(candidate => candidate.OrderId == order.Id && candidate.Kind == OrderFileKind.DeliveryReceipt, cancellationToken);
        if (file is null)
        {
            db.OrderFiles.Add(new OrderFile { OrderId = order.Id, Kind = OrderFileKind.DeliveryReceipt, ContentType = FileSignatures.Pdf, FileName = $"AgainBuy-receipt-{order.DeliveryReceiptNumber}.pdf", Data = pdf, CreatedAt = now });
        }
        else
        {
            file.Data = pdf;
            file.CreatedAt = now;
        }
    }

    private ActionResult InvalidFile(string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["file"] = [message] }));

    private static string Lkr(decimal amount) => $"LKR {amount:N0}";

    private static string OtherParty(Order order, string userId) => order.BuyerId == userId ? order.SellerId : order.BuyerId;

    private static string NameOf(Order order, string userId) => (order.BuyerId == userId ? order.Buyer?.Name : order.Seller?.Name) ?? "The other party";

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
