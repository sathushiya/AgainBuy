import { canAccess } from "../src/config/permissions";
import { demoUsers } from "../src/data/demoUsers";
import { authService } from "../src/services/authService";

async function run() {
  for (const account of demoUsers) {
    const user = await authService.signIn(account.email, account.password);
    if (user.role !== account.role) throw new Error(`Role mismatch for ${account.email}`);
    console.log(`PASS ${account.role}: ${account.email}`);
  }
  try {
    await authService.signIn("customer@againbuy.demo", "wrong-password");
    throw new Error("Invalid credentials were accepted");
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials were accepted") throw error;
    console.log("PASS invalid credentials rejected");
  }
  if (!canAccess("customer", "listing.create") || canAccess("customer", "platform.user_manage")) throw new Error("Customer permissions are incorrect");
  if (!canAccess("admin", "platform.user_manage") || canAccess("admin", "listing.manage_own")) throw new Error("Administrator permissions are incorrect");
  console.log("PASS central permission boundaries");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
