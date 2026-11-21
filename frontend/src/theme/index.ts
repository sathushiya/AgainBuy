import { DefaultTheme } from "@react-navigation/native";
import { Platform, TextStyle } from "react-native";

export const colors = {
  terracotta: "#C66B4E",
  terracottaDark: "#B95132",
  cream: "#FAF3E8",
  creamSecondary: "#F4E9DC",
  charcoal: "#292929",
  green: "#2F7D55",
  white: "#FFFFFF",
  textSecondary: "#6B625B",
  border: "#E5D9CC",
  warning: "#D99024",
  error: "#C84040",
  greenSoft: "#F4E9DC",
  terracottaSoft: "#F4E9DC",
  overlay: "rgba(41,41,41,0.52)",
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;
export const typography = {
  display: { fontSize: 31, lineHeight: 37, fontWeight: "800", letterSpacing: -1 } satisfies TextStyle,
  heading: { fontSize: 23, lineHeight: 29, fontWeight: "800", letterSpacing: -0.5 } satisfies TextStyle,
  title: { fontSize: 17, lineHeight: 22, fontWeight: "700" } satisfies TextStyle,
  body: { fontSize: 14, lineHeight: 21, fontWeight: "400" } satisfies TextStyle,
  medium: { fontSize: 14, lineHeight: 20, fontWeight: "600" } satisfies TextStyle,
  caption: { fontSize: 12, lineHeight: 17, fontWeight: "500" } satisfies TextStyle,
  label: { fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.35 } satisfies TextStyle,
} as const;
export const shadows = {
  card: Platform.select({ ios: { shadowColor: colors.charcoal, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 3 }, default: {} }),
};
export const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.terracotta, background: colors.cream, card: colors.white, text: colors.charcoal, border: colors.border, notification: colors.error },
};
