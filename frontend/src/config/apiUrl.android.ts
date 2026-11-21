// The Android emulator reaches the host machine at 10.0.2.2, not localhost.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:5080";
