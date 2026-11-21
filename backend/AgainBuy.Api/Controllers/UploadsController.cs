using AgainBuy.Api.Auth;
using AgainBuy.Api.Images;
using AgainBuy.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AgainBuy.Api.Controllers;

[ApiController]
[Route("api/uploads")]
[EnableRateLimiting(RateLimitPolicies.Uploads)]
public class UploadsController(IImageStorage storage) : ControllerBase
{
    public const long MaxImageBytes = 10 * 1024 * 1024;

    /// <summary>
    /// Uploads one listing photo (multipart field "file") and returns its URL,
    /// which the client then includes in the listing's "images".
    /// </summary>
    [HttpPost("images")]
    [Authorize(Policy = Permissions.ListingCreate)]
    [RequestSizeLimit(MaxImageBytes + 64 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxImageBytes + 64 * 1024)]
    public async Task<ActionResult<StoredImage>> UploadImage(IFormFile? file, CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured)
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Photo uploads aren't set up on this server yet.");
        if (file is null || file.Length == 0)
            return Invalid("Choose a photo to upload.");
        if (file.Length > MaxImageBytes)
            return Invalid("Photos must be 10 MB or smaller.");

        await using var content = file.OpenReadStream();
        // Trust the bytes, not the client's file name or content type.
        if (!await LooksLikeImage(content, cancellationToken))
            return Invalid("Only JPEG, PNG, WebP or HEIC photos can be uploaded.");
        content.Position = 0;

        try
        {
            var image = await storage.UploadAsync(content, Path.GetFileName(file.FileName), User.UserId(), cancellationToken);
            return StatusCode(StatusCodes.Status201Created, image);
        }
        catch (ImageStorageException)
        {
            return Problem(statusCode: StatusCodes.Status502BadGateway, title: "The photo couldn't be stored. Please try again.");
        }
    }

    private static async Task<bool> LooksLikeImage(Stream content, CancellationToken cancellationToken)
    {
        var header = new byte[12];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        if (read < header.Length) return false;

        bool At(int offset, params byte[] bytes) => header.AsSpan(offset, bytes.Length).SequenceEqual(bytes);
        bool Ascii(int offset, string text) => At(offset, System.Text.Encoding.ASCII.GetBytes(text));

        return At(0, 0xFF, 0xD8, 0xFF)                                   // JPEG
            || At(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)       // PNG
            || (Ascii(0, "RIFF") && Ascii(8, "WEBP"))                      // WebP
            || (Ascii(4, "ftyp") && (Ascii(8, "heic") || Ascii(8, "heix") || Ascii(8, "mif1") || Ascii(8, "msf1"))); // HEIC/HEIF
    }

    private ActionResult Invalid(string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["file"] = [message] }));
}
