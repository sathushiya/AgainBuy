using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize(Policy = Permissions.MarketplaceBrowse)]
public class ConversationsController(AppDbContext db, TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ConversationDto>>> List(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var summaries = await Summaries(userId).ToListAsync(cancellationToken);
        return summaries.OrderByDescending(summary => summary.Time).ToList();
    }

    /// <summary>Returns the thread and marks the other participant's messages as read.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ConversationDetailDto>> Get(string id, CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        if (!await IsParticipant(id, userId, cancellationToken)) return NotFound();

        var now = time.GetUtcNow().UtcDateTime;
        await db.Messages
            .Where(message => message.ConversationId == id && message.SenderId != userId && message.ReadAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(message => message.ReadAt, now), cancellationToken);

        return await Detail(id, userId, cancellationToken);
    }

    /// <summary>Opens a thread with the seller, or continues the existing one for this product.</summary>
    [HttpPost]
    public async Task<ActionResult<ConversationDetailDto>> Start(StartConversationRequest request, CancellationToken cancellationToken)
    {
        var buyer = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (buyer is null) return Unauthorized();

        var product = await db.Products.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == request.ProductId && candidate.Status != ListingStatus.Inactive, cancellationToken);
        if (product is null) return NotFound();
        if (product.SellerId == buyer.Id)
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "You cannot message yourself about your own listing.");

        var conversation = await db.Conversations.SingleOrDefaultAsync(candidate => candidate.ProductId == product.Id && candidate.BuyerId == buyer.Id, cancellationToken);
        var created = conversation is null;
        if (conversation is null)
        {
            conversation = new Conversation { Id = Ids.New("c_"), ProductId = product.Id, BuyerId = buyer.Id, CreatedAt = time.GetUtcNow().UtcDateTime };
            db.Conversations.Add(conversation);
        }

        db.Messages.Add(NewMessage(conversation.Id, buyer, request.Message));
        await db.SaveChangesAsync(cancellationToken);

        var detail = await Detail(conversation.Id, buyer.Id, cancellationToken);
        return created ? CreatedAtAction(nameof(Get), new { id = conversation.Id }, detail) : detail;
    }

    [HttpPost("{id}/messages")]
    public async Task<ActionResult<MessageDto>> Send(string id, SendMessageRequest request, CancellationToken cancellationToken)
    {
        var sender = await db.Users.FindAsync([User.UserId()], cancellationToken);
        if (sender is null) return Unauthorized();
        if (!await IsParticipant(id, sender.Id, cancellationToken)) return NotFound();

        var message = NewMessage(id, sender, request.Body);
        db.Messages.Add(message);
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new MessageDto(message.Id, message.SenderName, message.Body, message.SentAt, IsMine: true));
    }

    private Message NewMessage(string conversationId, User sender, string body)
    {
        var now = time.GetUtcNow().UtcDateTime;
        // A sender has obviously read everything up to their own message.
        return new Message { ConversationId = conversationId, SenderId = sender.Id, SenderName = sender.Name, Body = body.Trim(), SentAt = now, ReadAt = now };
    }

    private Task<bool> IsParticipant(string conversationId, string userId, CancellationToken cancellationToken) =>
        db.Conversations.AnyAsync(conversation => conversation.Id == conversationId &&
            (conversation.BuyerId == userId || conversation.Product!.SellerId == userId), cancellationToken);

    private IQueryable<ConversationDto> Summaries(string userId, string? conversationId = null) =>
        db.Conversations.AsNoTracking()
            .Where(conversation => conversation.BuyerId == userId || conversation.Product!.SellerId == userId)
            .Where(conversation => conversationId == null || conversation.Id == conversationId)
            .Select(conversation => new
            {
                conversation.Id,
                conversation.ProductId,
                conversation.Product!.Title,
                conversation.Product.Image,
                IsBuyer = conversation.BuyerId == userId,
                SellerName = conversation.Product.SellerName,
                SellerAvatar = conversation.Product.SellerAvatar,
                BuyerName = conversation.Buyer!.Name,
                BuyerAvatar = conversation.Buyer.Avatar,
                Last = conversation.Messages.OrderByDescending(message => message.SentAt).Select(message => new { message.Body, message.SentAt }).FirstOrDefault(),
                Unread = conversation.Messages.Count(message => message.SenderId != userId && message.ReadAt == null),
                conversation.CreatedAt,
            })
            .Select(row => new ConversationDto(
                row.Id, row.ProductId, row.Title, row.Image,
                row.IsBuyer ? row.SellerName : row.BuyerName,
                row.IsBuyer ? row.SellerAvatar : row.BuyerAvatar,
                row.Last == null ? "" : row.Last.Body,
                row.Last == null ? row.CreatedAt : row.Last.SentAt,
                row.Unread));

    private async Task<ConversationDetailDto> Detail(string id, string userId, CancellationToken cancellationToken)
    {
        var summary = await Summaries(userId, id).SingleAsync(cancellationToken);
        var messages = await db.Messages.AsNoTracking()
            .Where(message => message.ConversationId == id)
            .OrderBy(message => message.SentAt).ThenBy(message => message.Id)
            .Select(message => new MessageDto(message.Id, message.SenderName, message.Body, message.SentAt, message.SenderId == userId))
            .ToListAsync(cancellationToken);
        return new ConversationDetailDto(summary, messages);
    }
}
