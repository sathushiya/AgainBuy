import { demoUsers } from "../data/demoUsers";
import { AppUser } from "../types";

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const authService = {
  async signIn(email: string, password: string): Promise<AppUser> {
    await wait(700);
    const normalizedEmail = email.trim().toLowerCase();
    const account = demoUsers.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!account) throw new AuthenticationError("Email or password is incorrect. Try a demo account.");
    const { password: _password, description: _description, ...user } = account;
    return user;
  },
  async signOut() {
    await wait(150);
  },
};
