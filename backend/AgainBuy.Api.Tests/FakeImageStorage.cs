using AgainBuy.Api.Images;

namespace AgainBuy.Api.Tests;

public sealed class FakeImageStorage : IImageStorage
{
    public bool IsConfigured { get; set; } = true;

    /// <summary>Cloud name used in returned URLs, mirroring Cloudinary's URL shape.</summary>
    public string CloudName { get; set; } = "test-cloud";

    public List<(string FileName, string UploaderId, long Bytes)> Uploads { get; } = [];

    public async Task<StoredImage> UploadAsync(Stream content, string fileName, string uploaderId, CancellationToken cancellationToken)
    {
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy, cancellationToken);
        Uploads.Add((fileName, uploaderId, copy.Length));
        return new StoredImage($"https://res.cloudinary.com/{CloudName}/image/upload/v1/againbuy/listings/{Guid.NewGuid():N}.jpg", 800, 600);
    }
}
