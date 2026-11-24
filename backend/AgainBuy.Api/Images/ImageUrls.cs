namespace AgainBuy.Api.Images;

public static class ImageUrls
{
    /// <summary>
    /// With Cloudinary configured, only photos uploaded to our own cloud are
    /// accepted, so listings and messages can't hotlink arbitrary content.
    /// Without it (development, tests), any http(s) URL is allowed.
    /// </summary>
    public static bool IsAllowed(string image, CloudinaryOptions options)
    {
        if (!Uri.TryCreate(image, UriKind.Absolute, out var uri)) return false;
        if (!options.IsComplete) return uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp;
        return uri.Scheme == Uri.UriSchemeHttps
            && uri.Host == "res.cloudinary.com"
            && uri.AbsolutePath.StartsWith($"/{options.CloudName}/image/upload/", StringComparison.Ordinal);
    }
}
