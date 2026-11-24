using AgainBuy.Api.Data;
using AgainBuy.Api.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgainBuy.Api.Controllers;

/// <summary>Serves an order's private file for a signed link from GET /api/orders/{id}/files/{kind}/link.</summary>
[ApiController]
[Route("api/files")]
[AllowAnonymous]
public class FilesController(AppDbContext db, OrderFileLinks links) : ControllerBase
{
    [HttpGet("{token}")]
    public async Task<IActionResult> Download(string token, CancellationToken cancellationToken)
    {
        if (links.Read(token) is not { } target) return NotFound();

        var file = await db.OrderFiles.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.OrderId == target.OrderId && candidate.Kind == target.Kind, cancellationToken);
        if (file is null) return NotFound();

        Response.Headers.CacheControl = "private, no-store";
        // Images are shown inline (receipt previews); PDFs download with their file name.
        return file.ContentType.StartsWith("image/", StringComparison.Ordinal)
            ? File(file.Data, file.ContentType)
            : File(file.Data, file.ContentType, file.FileName);
    }
}
