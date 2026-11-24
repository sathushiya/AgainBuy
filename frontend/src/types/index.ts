// These mirror the JSON returned by the AgainBuy API (backend/AgainBuy.Api/Contracts/Dtos.cs).
// Timestamps are ISO-8601 UTC strings; format them with src/utils/format.ts.

export type ProductCondition = "Like new" | "Excellent" | "Good" | "Fair";
/** How the seller hands the item over; matches the chips on the Sell screen. */
export type DeliveryOption = "Delivery" | "Meet-up";

/** Couriers a seller books on their own websites; AgainBuy doesn't integrate with them. */
export type CourierService = "PickMe" | "Domex";

/** One category-specific detail, e.g. { key: "storage", label: "Storage capacity", value: "256 GB" }. */
export interface ProductSpecification {
  key: string;
  label: string;
  value: string;
}
export type ListingStatus = "Active" | "Reserved" | "Sold" | "Inactive";
export type UserRole = "customer" | "admin";
export type AccountStatus = "Active" | "Review" | "Inactive";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  location: string;
  memberSince: string;
  permissions: string[];
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: AppUser;
}

export interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number | null;
  image: string;
  images: string[];
  condition: ProductCondition;
  usage: string;
  purchaseYear: number;
  location: string;
  seller: string;
  sellerAvatar: string;
  sellerRating: number;
  brand: string;
  model: string;
  description: string;
  defects: string;
  accessories: string;
  /** Empty when the seller didn't give one. */
  reasonForSelling: string;
  delivery: DeliveryOption;
  courier: CourierService | null;
  /** In the order the Sell screen showed them; empty for older listings. */
  specifications: ProductSpecification[];
  listedAt: string;
  status: ListingStatus;
  isOwn: boolean;
  /** False for demo sellers without accounts, who can't take reservations. */
  hasSellerAccount: boolean;
  /** The viewer's live order for this product (as buyer or seller), from the detail endpoint. */
  myOrderId?: string | null;
}

export interface ListingInput {
  title: string;
  category: string;
  price: number;
  originalPrice?: number;
  condition: ProductCondition;
  /** Optional: only categories with these fields send them. */
  brand?: string;
  model?: string;
  usage: string;
  purchaseYear: number;
  description: string;
  defects: string;
  accessories?: string;
  reasonForSelling?: string;
  delivery?: DeliveryOption;
  courier?: CourierService;
  specifications?: ProductSpecification[];
  location: string;
  images?: string[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Category {
  id: number;
  name: string;
}

export type User = AppUser;

export interface DemoUser extends Omit<AppUser, "permissions"> {
  password: string;
  description: string;
}

export interface Facility {
  id: string;
  name: string;
  location: string;
  resourceCount: number;
  activeBookings: number;
  status: "Operational" | "Limited" | "Maintenance";
}

export interface Conversation {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  person: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  /** This buyer's reservation of the product (not cancelled); the chat's product card opens it. */
  orderId: string | null;
}

export interface Message {
  id: number;
  senderName: string;
  /** May be empty when the message is just a photo. */
  body: string;
  imageUrl: string | null;
  sentAt: string;
  isMine: boolean;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

export type TransactionStatus = "Completed" | "Meetup scheduled" | "Cancelled";

export interface Transaction {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  type: "purchase" | "sale";
  party: string;
  amount: number;
  date: string;
  status: TransactionStatus;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  joined: string;
}

export type ModerationStatus = "Pending" | "Evidence requested" | "Urgent" | "Dismissed" | "Removed";

export interface ModerationCase {
  id: string;
  productId: string | null;
  title: string;
  reason: string;
  seller: string;
  status: ModerationStatus;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeCustomers: number;
  facilities: number;
  activeListings: number;
  pendingReviews: number;
  reportsAndFlags: number;
  recentActivity: { description: string; at: string }[];
}

export interface AccountSettings {
  notifyMessages: boolean;
  notifyOrders: boolean;
  notifyNews: boolean;
  /** Reusable pickup spots; the first one prefills the Sell form. */
  savedLocations: string[];
  /** Shown to buyers once a deal is agreed. */
  bankDetails: string;
}

export type SupportTicketType = "problem" | "contact";

export interface SupportTicket {
  id: string;
  type: SupportTicketType;
  subject: string;
  status: "Open" | "Closed";
  createdAt: string;
}

// ---- Orders: reserve → negotiate → pay → deliver ----------------------------

export type OrderStatus =
  | "Negotiating" | "Deal agreed" | "Payment pending" | "Payment verification pending" | "Payment confirmed"
  | "Shipped" | "Ready for pickup" | "Delivered" | "Completed" | "Cancelled";

/** What the signed-in user may do now; the API enforces the same rules. */
export type OrderAction =
  | "proposePrice" | "agree" | "cancel" | "uploadReceipt" | "confirmPayment" | "rejectPayment"
  | "ship" | "readyForPickup" | "confirmDelivery";

export interface OrderParty {
  id: string;
  name: string;
  avatar: string;
  location: string;
}

export interface OrderSummary {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  status: OrderStatus;
  isBuyer: boolean;
  otherParty: OrderParty;
  agreedPrice: number;
  deliveryMethod: DeliveryOption;
  courier: CourierService | null;
  createdAt: string;
  updatedAt: string;
  hasDeliveryReceipt: boolean;
}

export interface OrderEvent {
  status: OrderStatus;
  note: string;
  at: string;
  actorName: string | null;
}

export interface OrderDetail {
  summary: OrderSummary;
  buyer: OrderParty;
  seller: OrderParty;
  listingPrice: number;
  buyerAgreedAt: string | null;
  sellerAgreedAt: string | null;
  /** The seller's bank details; empty for the buyer until the deal is agreed. */
  paymentInstructions: string;
  paymentReference: string;
  paymentSubmittedAt: string | null;
  paymentConfirmedAt: string | null;
  hasPaymentReceipt: boolean;
  trackingNumber: string;
  deliveryNotes: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  deliveryReceiptNumber: string | null;
  conversationId: string | null;
  history: OrderEvent[];
  actions: OrderAction[];
}

export type NotificationType =
  | "Reserved" | "ReservationCancelled" | "PriceChanged" | "DealAgreed" | "PaymentSubmitted" | "PaymentConfirmed"
  | "PaymentRejected" | "Shipped" | "ReadyForPickup" | "ReceiptGenerated" | "Delivered" | "Completed";

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  orderId: string | null;
  createdAt: string;
  read: boolean;
}
