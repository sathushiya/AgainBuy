using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace AgainBuy.Api.Images;

public record StoredImage(string Url, int Width, int Height);

public interface IImageStorage
{
    /// <summary>False when no storage provider is configured; uploads then answer 503.</summary>
    bool IsConfigured { get; }

    Task<StoredImage> UploadAsync(Stream content, string fileName, string uploaderId, CancellationToken cancellationToken);
}

public class CloudinaryOptions
{
    public const string Section = "Cloudinary";

    public string CloudName { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string ApiSecret { get; set; } = "";

    /// <summary>Cloudinary folder for listing photos.</summary>
    public string Folder { get; set; } = "againbuy/listings";

    public bool IsComplete => CloudName != "" && ApiKey != "" && ApiSecret != "";
}

public class CloudinaryImageStorage(IOptions<CloudinaryOptions> options, ILogger<CloudinaryImageStorage> logger) : IImageStorage
{
    private readonly CloudinaryOptions _options = options.Value;
    private readonly Lazy<Cloudinary> _client = new(() =>
    {
        var settings = options.Value;
        return new Cloudinary(new Account(settings.CloudName, settings.ApiKey, settings.ApiSecret)) { Api = { Secure = true } };
    });

    public bool IsConfigured => _options.IsComplete;

    public async Task<StoredImage> UploadAsync(Stream content, string fileName, string uploaderId, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("Cloudinary is not configured.");

        var result = await _client.Value.UploadAsync(new ImageUploadParams
        {
            File = new FileDescription(fileName, content),
            Folder = _options.Folder,
            UseFilename = false,
            UniqueFilename = true,
            Overwrite = false,
            // Applied by Cloudinary before storing: cap the size and strip
            // metadata such as GPS location from phone photos.
            Transformation = new Transformation().Width(1600).Height(1600).Crop("limit").Quality("auto").Flags("strip_profile"),
            Tags = "againbuy,listing",
            Context = new StringDictionary($"uploader={uploaderId}"),
        }, cancellationToken);

        if (result.Error is not null || result.SecureUrl is null)
        {
            logger.LogError("Cloudinary upload failed: {Error}", result.Error?.Message);
            throw new ImageStorageException(result.Error?.Message ?? "Upload failed.");
        }

        return new StoredImage(result.SecureUrl.ToString(), result.Width, result.Height);
    }
}

public class ImageStorageException(string message) : Exception(message);
