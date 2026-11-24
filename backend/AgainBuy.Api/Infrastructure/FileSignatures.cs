namespace AgainBuy.Api.Infrastructure;

/// <summary>Identifies uploads by their first bytes rather than the client's file name or content type.</summary>
public static class FileSignatures
{
    public const string Pdf = "application/pdf";

    /// <summary>The detected content type (JPEG, PNG, WebP, HEIC or PDF), or null if it's none of those.</summary>
    public static async Task<string?> DetectAsync(Stream content, CancellationToken cancellationToken)
    {
        var header = new byte[12];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        if (read < header.Length) return null;

        bool At(int offset, params byte[] bytes) => header.AsSpan(offset, bytes.Length).SequenceEqual(bytes);
        bool Ascii(int offset, string text) => At(offset, System.Text.Encoding.ASCII.GetBytes(text));

        if (At(0, 0xFF, 0xD8, 0xFF)) return "image/jpeg";
        if (At(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return "image/png";
        if (Ascii(0, "RIFF") && Ascii(8, "WEBP")) return "image/webp";
        if (Ascii(4, "ftyp") && (Ascii(8, "heic") || Ascii(8, "heix") || Ascii(8, "mif1") || Ascii(8, "msf1"))) return "image/heic";
        if (Ascii(0, "%PDF-")) return Pdf;
        return null;
    }
}
