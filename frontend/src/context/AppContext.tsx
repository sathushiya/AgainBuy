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
  signIn: (email: string, password: string) => Promise<boolean>;
  /** Resolves to an error message, or null on success. */
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  toggleWishlist: (id: string) => void;
  clearAuthError: () => void;
  hasPermission: (permission: Permission) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const logout = useCallback(() => {
    authService.signOut();
    setUser(null);
    setWishlist([]);
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
  }, [user]);

  const value = useMemo<AppContextValue>(() => ({
    user,
    isAuthenticating,
    authError,
    wishlist,
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
    toggleWishlist(id) {
      const adding = !wishlist.includes(id);
      const apply = (add: boolean) => setWishlist((current) => add ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      apply(adding);
      (adding ? api.addToWishlist(id) : api.removeFromWishlist(id)).catch(() => apply(!adding));
    },
    clearAuthError() { setAuthError(null); },
    hasPermission(permission) { return canAccess(user?.role, permission); },
  }), [user, wishlist, isAuthenticating, authError, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
