import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { canAccess, Permission } from "../config/permissions";
import { api, errorMessage, setUnauthorizedHandler } from "../services/api";
import { authService } from "../services/authService";
import { AppUser } from "../types";

interface AppContextValue {
  user: AppUser | null;
  isAuthenticating: boolean;
  authError: string | null;
  wishlist: string[];
  /** Unread messages across all conversations; drives the bell and Messages tab badges. */
  unreadMessages: number;
  refreshUnreadMessages: () => void;
  /** The "New message alerts" preference; when off, unread badges are hidden. */
  messageAlerts: boolean;
  setMessageAlerts: (enabled: boolean) => void;
  /** Unread order notifications (reservations, payments, shipping); shown on the Profile tab. */
  unreadNotifications: number;
  refreshNotifications: () => void;
  /** The "Purchase and sale updates" preference; when off, the notification badge is hidden. */
  orderAlerts: boolean;
  setOrderAlerts: (enabled: boolean) => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  /** Resolves to an error message, or null on success. */
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  /** Replaces the signed-in user, e.g. after editing the profile. */
  updateUser: (user: AppUser) => void;
  toggleWishlist: (id: string) => void;
  clearAuthError: () => void;
  hasPermission: (permission: Permission) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const UNREAD_POLL_MS = 15_000;

export function AppProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [orderAlerts, setOrderAlerts] = useState(true);

  const logout = useCallback(() => {
    authService.signOut();
    setUser(null);
    setWishlist([]);
    setUnreadMessages(0);
    setMessageAlerts(true);
    setUnreadNotifications(0);
    setOrderAlerts(true);
    setAuthError(null);
  }, []);

  // A 401 on any signed-in request means the token expired or the account was
  // deactivated; drop back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      setAuthError("Your session has ended. Please sign in again.");
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (user?.role !== "customer") return;
    api.wishlistIds().then(setWishlist).catch(() => setWishlist([]));
    api.accountSettings().then((settings) => { setMessageAlerts(settings.notifyMessages); setOrderAlerts(settings.notifyOrders); }).catch(() => {});
  }, [user]);

  const refreshNotifications = useCallback(() => {
    if (user?.role !== "customer") return;
    api.notificationUnreadCount().then(({ count }) => setUnreadNotifications(count)).catch(() => {});
  }, [user]);

  const refreshUnreadMessages = useCallback(() => {
    if (user?.role !== "customer") return;
    // Badges are best-effort; a failed refresh keeps the last known count.
    api.unreadCount().then(({ count }) => setUnreadMessages(count)).catch(() => {});
  }, [user]);

  // Poll while signed in so new messages show up without opening Messages.
  useEffect(() => {
    if (user?.role !== "customer") return;
    refreshUnreadMessages();
    refreshNotifications();
    const timer = setInterval(() => { refreshUnreadMessages(); refreshNotifications(); }, UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [user, refreshUnreadMessages, refreshNotifications]);

  const value = useMemo<AppContextValue>(() => ({
    user,
    isAuthenticating,
    authError,
    wishlist,
    unreadMessages,
    refreshUnreadMessages,
    messageAlerts,
    setMessageAlerts,
    unreadNotifications,
    refreshNotifications,
    orderAlerts,
    setOrderAlerts,
    async signIn(email, password) {
      if (isAuthenticating) return false;
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        setUser((await authService.signIn(email, password)).user);
        return true;
      } catch (error) {
        setAuthError(errorMessage(error));
        return false;
      } finally {
        setIsAuthenticating(false);
      }
    },
    async register(name, email, password) {
      try {
        setUser((await authService.register(name, email, password)).user);
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    logout,
    updateUser(next) { setUser(next); },
    toggleWishlist(id) {
      const adding = !wishlist.includes(id);
      const apply = (add: boolean) => setWishlist((current) => add ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      apply(adding);
      (adding ? api.addToWishlist(id) : api.removeFromWishlist(id)).catch(() => apply(!adding));
    },
    clearAuthError() { setAuthError(null); },
    hasPermission(permission) { return canAccess(user?.role, permission); },
  }), [user, wishlist, unreadMessages, refreshUnreadMessages, messageAlerts, unreadNotifications, refreshNotifications, orderAlerts, isAuthenticating, authError, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
