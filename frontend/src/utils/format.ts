import type { DeliveryOption } from "../types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Just now", "12 min ago", "3 hr ago", "Yesterday", "4 days ago", then "12 Jun 2025". */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** "12 Jun 2025" */
export function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Jun 2025" */
export function formatMonth(iso: string) {
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Clock time today ("9:42 AM"), otherwise a short date. */
export function messageTime(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (date.toDateString() !== now.toDateString()) return timeAgo(iso, now.getTime());
  const hours = date.getHours();
  return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/** Buyer-facing wording for a listing's delivery option. */
export function deliveryLabel(delivery: DeliveryOption) {
  return delivery === "Delivery" ? "Delivery available" : delivery === "Meet-up" ? "Meet-up only" : "Delivery or meet-up";
}
