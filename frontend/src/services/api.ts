import { API_URL } from "../config/apiUrl";
import type {
  AccountSettings, AdminStats, AppUser, AuthResponse, Category, Conversation, ConversationDetail, Facility, ListingInput, Message,
  ModerationCase, PagedResult, PlatformUser, Product, SupportTicket, SupportTicketType, Transaction, UserRole, AccountStatus,
} from "../types";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(value: string | null) {
  token = value;
}

/** Called when a signed-in request gets 401, e.g. the token expired or the account was deactivated. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Query = Record<string, string | number | boolean | undefined | null>;

async function request<T>(method: string, path: string, options: { body?: unknown; form?: FormData; query?: Query } = {}): Promise<T> {
  // Built by hand: React Native's URLSearchParams polyfill is incomplete on some versions.
  const search = Object.entries(options.query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  const url = `${API_URL}${path}${search ? `?${search}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        // Multipart bodies get their Content-Type (with boundary) from fetch itself.
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(`Can't reach the AgainBuy server at ${API_URL}. Check that the backend is running.`, 0);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    // The API answers errors with RFC 7807 problem details.
    const fieldErrors: Record<string, string[]> = data?.errors ?? {};
    const firstFieldError = Object.values(fieldErrors)[0]?.[0];
    const message = firstFieldError ?? data?.title ?? defaultMessage(response.status);
    throw new ApiError(message, response.status, fieldErrors);
  }
  return data as T;
}

function defaultMessage(status: number) {
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item could not be found.";
  if (status === 429) return "Too many attempts. Please wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

export const api = {
  // Auth
  login: (email: string, password: string) => request<AuthResponse>("POST", "/api/auth/login", { body: { email, password } }),
  register: (name: string, email: string, password: string) => request<AuthResponse>("POST", "/api/auth/register", { body: { name, email, password } }),
  forgotPassword: (email: string) => request<{ message: string }>("POST", "/api/auth/forgot-password", { body: { email } }),
  me: () => request<AppUser>("GET", "/api/auth/me"),
  updateProfile: (input: { name: string; location?: string; avatar?: string }) => request<AppUser>("PUT", "/api/auth/me", { body: input }),
  changePassword: (currentPassword: string, newPassword: string) => request<void>("POST", "/api/auth/change-password", { body: { currentPassword, newPassword } }),

  // Settings & Help
  accountSettings: () => request<AccountSettings>("GET", "/api/account/settings"),
  updateAccountSettings: (settings: AccountSettings) => request<AccountSettings>("PUT", "/api/account/settings", { body: settings }),
  supportTickets: () => request<SupportTicket[]>("GET", "/api/support/tickets"),
  createSupportTicket: (input: { type: SupportTicketType; subject: string; message: string }) => request<SupportTicket>("POST", "/api/support/tickets", { body: input }),

  // Marketplace
  categories: () => request<Category[]>("GET", "/api/categories"),
  products: (query: { search?: string; category?: string; condition?: string; maxPrice?: number; sort?: "newest" | "price_asc" | "price_desc"; page?: number; pageSize?: number } = {}) =>
    request<PagedResult<Product>>("GET", "/api/products", { query }),
  product: (id: string) => request<Product>("GET", `/api/products/${encodeURIComponent(id)}`),
  myListings: () => request<Product[]>("GET", "/api/products/mine"),
  createListing: (input: ListingInput) => request<Product>("POST", "/api/products", { body: input }),
  deactivateListing: (id: string) => request<Product>("POST", `/api/products/${encodeURIComponent(id)}/deactivate`),
  activateListing: (id: string) => request<Product>("POST", `/api/products/${encodeURIComponent(id)}/activate`),

  /** Uploads one listing photo to Cloudinary via the API. Native passes a file URI; web passes a Blob. */
  uploadImage: (file: { uri: string; name: string; type: string } | { webFile: Blob; name: string }) => {
    const form = new FormData();
    if ("webFile" in file) form.append("file", file.webFile, file.name);
    // React Native's FormData accepts { uri, name, type } for local files.
    else form.append("file", file as unknown as Blob);
    return request<{ url: string; width: number; height: number }>("POST", "/api/uploads/images", { form });
  },

  // Wishlist
  wishlist: () => request<Product[]>("GET", "/api/wishlist"),
  wishlistIds: () => request<string[]>("GET", "/api/wishlist/ids"),
  addToWishlist: (productId: string) => request<void>("PUT", `/api/wishlist/${encodeURIComponent(productId)}`),
  removeFromWishlist: (productId: string) => request<void>("DELETE", `/api/wishlist/${encodeURIComponent(productId)}`),

  // Messages
  conversations: () => request<Conversation[]>("GET", "/api/conversations"),
  unreadCount: () => request<{ count: number }>("GET", "/api/conversations/unread-count"),
  conversation: (id: string) => request<ConversationDetail>("GET", `/api/conversations/${encodeURIComponent(id)}`),
  startConversation: (productId: string, message: string) => request<ConversationDetail>("POST", "/api/conversations", { body: { productId, message } }),
  sendMessage: (conversationId: string, body: string) => request<Message>("POST", `/api/conversations/${encodeURIComponent(conversationId)}/messages`, { body: { body } }),

  // Transactions
  transactions: (type?: "purchase" | "sale") => request<Transaction[]>("GET", "/api/transactions", { query: { type } }),
  purchase: (productId: string) => request<Transaction>("POST", "/api/transactions", { body: { productId } }),
  completeTransaction: (id: string) => request<Transaction>("POST", `/api/transactions/${encodeURIComponent(id)}/complete`),
  cancelTransaction: (id: string) => request<Transaction>("POST", `/api/transactions/${encodeURIComponent(id)}/cancel`),

  // Administration
  adminStats: () => request<AdminStats>("GET", "/api/admin/stats"),
  adminUsers: (search?: string) => request<PlatformUser[]>("GET", "/api/admin/users", { query: { search } }),
  setUserStatus: (id: string, status: AccountStatus) => request<PlatformUser>("PATCH", `/api/admin/users/${encodeURIComponent(id)}/status`, { body: { status } }),
  setUserRole: (id: string, role: UserRole) => request<PlatformUser>("PATCH", `/api/admin/users/${encodeURIComponent(id)}/role`, { body: { role } }),
  facilities: () => request<Facility[]>("GET", "/api/admin/facilities"),
  moderation: () => request<ModerationCase[]>("GET", "/api/admin/moderation"),
  requestEvidence: (id: string) => request<ModerationCase>("POST", `/api/admin/moderation/${encodeURIComponent(id)}/request-evidence`),
  removeListing: (id: string) => request<ModerationCase>("POST", `/api/admin/moderation/${encodeURIComponent(id)}/remove-listing`),
};

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
