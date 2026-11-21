// Base URL of the AgainBuy API (backend/). Override with EXPO_PUBLIC_API_URL,
// e.g. http://192.168.1.20:5080 when testing on a physical phone.
// apiUrl.android.ts supplies the Android-emulator default.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5080";
