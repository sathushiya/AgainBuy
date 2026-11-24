using AgainBuy.Api.Domain;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace AgainBuy.Api.Orders;

/// <summary>
/// Renders the delivery (or pickup) receipt PDF from an order's real data.
/// QuestPDF's Community licence is free for individuals and businesses under
/// USD 1M annual revenue; larger companies need a paid licence.
/// </summary>
public class DeliveryReceiptPdf(HttpClient http, ILogger<DeliveryReceiptPdf> logger)
{
    private const string Terracotta = "#C66B4E";
    private const string Charcoal = "#292929";
    private const string Muted = "#6B625B";
    private const string Cream = "#FAF3E8";

    static DeliveryReceiptPdf() => QuestPDF.Settings.License = LicenseType.Community;

    /// <param name="order">With Product, Buyer and Seller loaded.</param>
    public async Task<byte[]> RenderAsync(Order order, string receiptNumber, DateTime generatedAt, CancellationToken cancellationToken)
    {
        var product = order.Product ?? throw new InvalidOperationException("Order product not loaded.");
        var photo = await FetchPhoto(product.Image, cancellationToken);
        var delivery = order.DeliveryMethod == DeliveryOption.Delivery;

        var rows = new List<(string Label, string Value)>
        {
            ("Transaction ID", order.Id),
            ("Buyer", order.Buyer?.Name ?? ""),
            ("Seller", order.Seller?.Name ?? ""),
            ("Agreed price", $"LKR {order.AgreedPrice:N2}"),
            ("Payment", order.PaymentConfirmedAt is { } paid
                ? $"Bank transfer confirmed by the seller on {Date(paid)}{(order.PaymentReference != "" ? $" (reference {order.PaymentReference})" : "")}"
                : "Not yet confirmed"),
            ("Delivery method", delivery ? "Delivery" : "Pickup"),
        };
        if (delivery)
        {
            rows.Add(("Courier service", order.Courier?.ToString() ?? "Not specified"));
            rows.Add(("Tracking number", order.TrackingNumber == "" ? "Not provided" : order.TrackingNumber));
            rows.Add(("Shipment date", order.DispatchedAt is { } shipped ? Date(shipped) : "Not shipped yet"));
        }
        else
        {
            rows.Add(("Pickup location", product.Location));
            rows.Add(("Ready for pickup", order.DispatchedAt is { } ready ? Date(ready) : "Not ready yet"));
        }
        if (order.DeliveryNotes != "") rows.Add((delivery ? "Delivery notes" : "Pickup notes", order.DeliveryNotes));
        rows.Add(("Status", order.DeliveredAt is { } received ? $"Received by the buyer on {Date(received)}" : delivery ? "Shipped" : "Ready for pickup"));

        return Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(40);
            page.DefaultTextStyle(text => text.FontSize(10).FontColor(Charcoal));

            page.Header().Row(row =>
            {
                row.RelativeItem().Column(column =>
                {
                    column.Item().Text(text =>
                    {
                        text.Span("Again").FontSize(24).Bold();
                        text.Span("Buy").FontSize(24).Bold().FontColor(Terracotta);
                    });
                    column.Item().Text("Buy · Sell · Give New Life").FontSize(9).FontColor(Muted);
                });
                row.RelativeItem().AlignRight().Column(column =>
                {
                    column.Item().AlignRight().Text(delivery ? "DELIVERY RECEIPT" : "PICKUP RECEIPT").FontSize(14).Bold().FontColor(Terracotta);
                    column.Item().AlignRight().Text($"Receipt no. {receiptNumber}").SemiBold();
                    column.Item().AlignRight().Text($"Issued {Date(generatedAt)}").FontColor(Muted);
                });
            });

            page.Content().PaddingVertical(20).Column(column =>
            {
                column.Spacing(16);
                column.Item().Background(Cream).Padding(14).Row(row =>
                {
                    if (photo is not null) row.ConstantItem(110).Height(110).Image(photo).FitArea();
                    row.RelativeItem().PaddingLeft(photo is null ? 0 : 14).Column(details =>
                    {
                        details.Item().Text(product.Title).FontSize(14).Bold();
                        details.Item().PaddingTop(4).Text(product.Description).FontColor(Muted);
                    });
                });

                column.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(140);
                        columns.RelativeColumn();
                    });
                    foreach (var (label, value) in rows)
                    {
                        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(7).Text(label).FontColor(Muted);
                        table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(7).Text(value).SemiBold();
                    }
                });

                if (delivery && order.TrackingNumber != "")
                    column.Item().Text($"Track this parcel on the {order.Courier} website with the tracking number above. AgainBuy does not track shipments itself.").FontSize(9).FontColor(Muted);
            });

            page.Footer().Column(column =>
            {
                column.Item().Text($"Generated by AgainBuy from order {order.Id} on {Date(generatedAt)}. AgainBuy does not process payments; this receipt records the bank transfer the seller confirmed.").FontSize(8).FontColor(Muted);
                column.Item().AlignRight().Text(text =>
                {
                    text.DefaultTextStyle(style => style.FontSize(8).FontColor(Muted));
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        })).GeneratePdf();
    }

    private static string Date(DateTime utc) => utc.ToString("d MMMM yyyy, HH:mm 'UTC'");

    /// <summary>The product photo, or null if it can't be fetched or decoded (the receipt is still produced).</summary>
    private async Task<Image?> FetchPhoto(string url, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return null;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(5));
            var bytes = await http.GetByteArrayAsync(uri, timeout.Token);
            return Image.FromBinaryData(bytes);
        }
        // Any failure (network, timeout, unreadable image) just leaves the photo out,
        // unless the whole request was cancelled.
        catch (Exception error) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Delivery receipt photo skipped for {Url}: {Message}", url, error.Message);
            return null;
        }
    }
}
