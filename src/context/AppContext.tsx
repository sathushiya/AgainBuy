import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";
import { products } from "../data/mockData";
import { demoUsers } from "../data/demoUsers";
import { authService } from "../services/authService";
import { AppUser, Product } from "../types";
import { canAccess, Permission } from "../config/permissions";

interface AppContextValue {
  user: AppUser | null;
  isAuthenticating: boolean;
  authError: string | null;
  wishlist: string[];
  listings: Product[];
  signIn: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string) => Promise<void>;
  logout: () => void;
  toggleWishlist: (id: string) => void;
  publishListing: (product: Product) => void;
  deactivateListing: (id: string) => void;
  clearAuthError: () => void;
  hasPermission: (permission: Permission) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(["p1", "p3"]);
  const customer = demoUsers[0]!;
  const [listings, setListings] = useState<Product[]>([{ ...products[4]!, id: "mine_1", seller: customer.name, status: "Active" }]);

  const value = useMemo<AppContextValue>(() => ({
    user,
    isAuthenticating,
    authError,
    wishlist,
    listings,
    async signIn(email, password) {
      if (isAuthenticating) return false;
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        setUser(await authService.signIn(email, password));
        return true;
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
        return false;
      } finally {
        setIsAuthenticating(false);
      }
    },
    async register(name, email) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      setUser({ ...customer, name, email, role: "customer" });
    },
    logout() { setUser(null); setAuthError(null); },
    toggleWishlist(id) { setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); },
    publishListing(product) { setListings((current) => [product, ...current]); },
    deactivateListing(id) { setListings((current) => current.map((item) => item.id === id ? { ...item, status: "Inactive" } : item)); },
    clearAuthError() { setAuthError(null); },
    hasPermission(permission) { return canAccess(user?.role, permission); },
  }), [user, wishlist, listings, isAuthenticating, authError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
