using AgainBuy.Api.Auth;
using AgainBuy.Api.Contracts;
using AgainBuy.Api.Data;
using AgainBuy.Api.Domain;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

/// <summary>"Report a problem" and "Contact support" requests from Settings &amp; Help.</summary>
[ApiController]
[Route("api/support/tickets")]
[Authorize]
public class SupportController(AppDbContext db, TimeProvider time) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<SupportTicketDto>> Create(CreateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        var ticket = new SupportTicket
        {
            Id = Ids.New("SUP-"),
            UserId = User.UserId(),
            Type = request.Type!.Value,
            Subject = request.Subject.Trim(),
            Message = request.Message.Trim(),
            CreatedAt = time.GetUtcNow().UtcDateTime,
        };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ticket.ToDto());
    }

    /// <summary>The signed-in user's own requests, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupportTicketDto>>> Mine(CancellationToken cancellationToken)
    {
        var userId = User.UserId();
        var tickets = await db.SupportTickets.AsNoTracking()
            .Where(ticket => ticket.UserId == userId)
            .OrderByDescending(ticket => ticket.CreatedAt)
            .ToListAsync(cancellationToken);
        return tickets.Select(ticket => ticket.ToDto()).ToList();
    }
}
