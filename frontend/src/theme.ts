// Federal Trial — Glass / Luxe DARK theme.
// Values pulled from /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0A0B0E",
  onSurface: "#EAECEF",
  surfaceSecondary: "#14161C",
  onSurfaceSecondary: "#D1D6E0",
  surfaceTertiary: "#1E212A",
  onSurfaceTertiary: "#BAC1CE",
  surfaceInverse: "#F5F3ED",
  onSurfaceInverse: "#0A0B0E",
  muted: "#737D8F",

  brand: "#D4AF37",
  onBrand: "#000000",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#000000",
  brandSecondary: "#B5952F",
  onBrandSecondary: "#000000",
  brandTertiary: "rgba(212, 175, 55, 0.15)",
  onBrandTertiary: "#D4AF37",

  success: "#2A6E46",
  onSuccess: "#FFFFFF",
  warning: "#A87C22",
  onWarning: "#FFFFFF",
  error: "#8B2323",
  onError: "#FFFFFF",
  info: "#2F5073",
  onInfo: "#FFFFFF",

  border: "#232630",
  borderStrong: "#3B404D",
  divider: "#1B1E26",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Static export for module-level consumers (e.g. StyleSheet.create at import time
// in this dark-only app). Prefer useTheme()/makeStyles for future light-mode.
export const colors = dark;

// Design tokens
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

// Font families — using system serif for display (Cormorant-esque cinematic feel)
// and system sans for body. Avoids @expo-google-fonts (banned).
import { Platform } from "react-native";
export const fonts = {
  display: Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "Georgia, 'Times New Roman', serif",
  }) as string,
  text: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  }) as string,
};
