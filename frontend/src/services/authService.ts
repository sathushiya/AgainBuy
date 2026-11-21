import { api, setAuthToken } from "./api";
import type { AuthResponse } from "../types";

// Sign-in goes through the AgainBuy API; the token lives in memory only, so
// reloading the app signs the user out.
export const authService = {
  async signIn(email: string, password: string): Promise<AuthResponse> {
    const session = await api.login(email.trim().toLowerCase(), password);
    setAuthToken(session.token);
    return session;
  },
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const session = await api.register(name.trim(), email.trim().toLowerCase(), password);
    setAuthToken(session.token);
    return session;
  },
  signOut() {
    setAuthToken(null);
  },
};
