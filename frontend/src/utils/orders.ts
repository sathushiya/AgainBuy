import type { DeliveryOption, OrderDetail, OrderStatus, OrderSummary } from "../types";

/** The eight stages each kind of order goes through, in order. */
export const ORDER_STEPS: Readonly<Record<DeliveryOption, readonly OrderStatus[]>> = {
  Delivery: ["Negotiating", "Deal agreed", "Payment pending", "Payment verification pending", "Payment confirmed", "Shipped", "Delivered", "Completed"],
  "Meet-up": ["Negotiating", "Deal agreed", "Payment pending", "Payment verification pending", "Payment confirmed", "Ready for pickup", "Delivered", "Completed"],
};

/** When the order last entered each status, from its history. */
export function stepTimes(order: OrderDetail): Partial<Record<OrderStatus, string>> {
  const times: Partial<Record<OrderStatus, string>> = {};
  for (const change of order.history) times[change.status] = change.at;
  return times;
}

export interface OrderSection {
  key: string;
  label: string;
  matches: (order: OrderSummary) => boolean;
}

const open = (order: OrderSummary) => order.status !== "Completed" && order.status !== "Cancelled";

/** Buyer dashboard ("My orders") filters. */
export const BUYER_SECTIONS: readonly OrderSection[] = [
  { key: "reservations", label: "My reservations", matches: (order) => order.status === "Negotiating" },
  { key: "purchases", label: "My purchases", matches: open },
  { key: "payment", label: "Payment pending", matches: (order) => order.status === "Deal agreed" || order.status === "Payment pending" },
  { key: "verification", label: "Payment verification", matches: (order) => order.status === "Payment verification pending" || order.status === "Payment confirmed" },
  { key: "delivery", label: "Orders in delivery", matches: (order) => order.status === "Shipped" || order.status === "Ready for pickup" },
  { key: "completed", label: "Completed purchases", matches: (order) => order.status === "Completed" },
  { key: "receipts", label: "Download receipts", matches: (order) => order.hasDeliveryReceipt },
  { key: "cancelled", label: "Cancelled", matches: (order) => order.status === "Cancelled" },
];

/** Seller dashboard ("Reserved by customers") filters. */
export const SELLER_SECTIONS: readonly OrderSection[] = [
  { key: "reservations", label: "Reserved by customers", matches: (order) => order.status === "Negotiating" },
  { key: "active", label: "Active transactions", matches: open },
  { key: "verification", label: "Payment verification", matches: (order) => order.status === "Payment verification pending" },
  { key: "toShip", label: "Orders to ship", matches: (order) => order.status === "Payment confirmed" },
  { key: "completed", label: "Completed sales", matches: (order) => order.status === "Completed" },
  { key: "cancelled", label: "Cancelled", matches: (order) => order.status === "Cancelled" },
];

/** A short "what happens next" line for the signed-in party. */
export function nextStep(order: OrderSummary): string {
  const buyer = order.isBuyer;
  const pickup = order.deliveryMethod === "Meet-up";
  switch (order.status) {
    case "Negotiating": return "Agree the price in chat, then both confirm the deal.";
    case "Deal agreed":
    case "Payment pending": return buyer ? "Transfer the money and upload your receipt." : "Waiting for the buyer's bank transfer.";
    case "Payment verification pending": return buyer ? "The seller is checking your payment." : "Check your bank account, then confirm the payment.";
    case "Payment confirmed": return buyer ? (pickup ? "The seller will tell you when it's ready to collect." : "The seller will ship it and add the tracking number.") : (pickup ? "Mark it ready for pickup when it is." : "Book the courier, then mark it as shipped.");
    case "Shipped": return buyer ? "Confirm delivery once you've received it." : "Waiting for the buyer to confirm delivery.";
    case "Ready for pickup": return buyer ? "Collect it, then confirm you've received it." : "Waiting for the buyer to collect it.";
    case "Delivered":
    case "Completed": return buyer ? "You received this item." : "Sale complete.";
    case "Cancelled": return "The reservation was removed.";
  }
}
