using AgainBuy.Api.Domain;

namespace AgainBuy.Api.Orders;

/// <summary>
/// Who may do what at each stage of an order. The API checks every action
/// against these rules, and returns the allowed ones so the app can show
/// only the buttons that will work.
/// </summary>
public static class OrderActions
{
    public const string ProposePrice = "proposePrice";
    public const string Agree = "agree";
    public const string Cancel = "cancel";
    public const string UploadReceipt = "uploadReceipt";
    public const string ConfirmPayment = "confirmPayment";
    public const string RejectPayment = "rejectPayment";
    public const string Ship = "ship";
    public const string ReadyForPickup = "readyForPickup";
    public const string ConfirmDelivery = "confirmDelivery";

    private static readonly HashSet<string> BuyerOnly = [Cancel, UploadReceipt, ConfirmDelivery];
    private static readonly HashSet<string> SellerOnly = [ConfirmPayment, RejectPayment, Ship, ReadyForPickup];

    public static IReadOnlyList<string> For(Order order, string userId)
    {
        var isBuyer = order.BuyerId == userId;
        var isSeller = order.SellerId == userId;
        var actions = new List<string>();

        switch (order.Status)
        {
            case OrderStatus.Negotiating:
                actions.Add(ProposePrice);
                if ((isBuyer && order.BuyerAgreedAt is null) || (isSeller && order.SellerAgreedAt is null)) actions.Add(Agree);
                if (isBuyer) actions.Add(Cancel);
                break;
            case OrderStatus.PaymentPending:
                if (isBuyer) actions.AddRange([UploadReceipt, Cancel]);
                break;
            case OrderStatus.PaymentVerificationPending:
                // The buyer may replace an unclear receipt; only the seller can confirm.
                if (isBuyer) actions.Add(UploadReceipt);
                if (isSeller) actions.AddRange([ConfirmPayment, RejectPayment]);
                break;
            case OrderStatus.PaymentConfirmed:
                if (isSeller) actions.Add(order.DeliveryMethod == DeliveryOption.Delivery ? Ship : ReadyForPickup);
                break;
            case OrderStatus.Shipped or OrderStatus.ReadyForPickup:
                // Only the buyer can say they received it.
                if (isBuyer) actions.Add(ConfirmDelivery);
                break;
        }
        return actions;
    }

    /// <summary>Null when the user may take the action now; otherwise the HTTP status and reason.</summary>
    public static (int Status, string Message)? Check(Order order, string userId, string action)
    {
        if (BuyerOnly.Contains(action) && order.BuyerId != userId) return (StatusCodes.Status403Forbidden, "Only the buyer can do this.");
        if (SellerOnly.Contains(action) && order.SellerId != userId) return (StatusCodes.Status403Forbidden, "Only the seller can do this.");
        if (action == Agree && order.Status == OrderStatus.Negotiating) return For(order, userId).Contains(Agree) ? null : (StatusCodes.Status409Conflict, "You've already agreed to this deal.");
        return For(order, userId).Contains(action) ? null : (StatusCodes.Status409Conflict, $"That isn't possible while the order is {Describe(order.Status)}.");
    }

    public static string Describe(OrderStatus status) => status switch
    {
        OrderStatus.DealAgreed => "deal agreed",
        OrderStatus.PaymentPending => "waiting for payment",
        OrderStatus.PaymentVerificationPending => "waiting for payment verification",
        OrderStatus.PaymentConfirmed => "paid",
        OrderStatus.ReadyForPickup => "ready for pickup",
        _ => status.ToString().ToLowerInvariant(),
    };
}
