export type AppTheme = "light" | "dark";
export type ThemePreference = AppTheme | "system";
export type AppStatusBarStyle = "light" | "dark";

export type ThemePalette = {
  background: string;
  backgroundMuted: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  atmosphereTeal: string;
  atmosphereAmber: string;
  atmosphereNeutral: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  buttonPrimaryBackground: string;
  buttonPrimaryText: string;
  buttonSecondaryBackground: string;
  buttonSecondaryText: string;
  accentSoft: string;
  errorSurface: string;
  errorBorder: string;
  errorText: string;
  skeleton: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
};

export const themePalettes: Record<AppTheme, ThemePalette> = {
  light: {
    background: "#FFFFFF",
    backgroundMuted: "#F8FAFC",
    surface: "#FFFFFF",
    surfaceMuted: "#F8FAFC",
    surfaceStrong: "#F1F5F9",
    atmosphereTeal: "rgba(13, 148, 136, 0.05)",
    atmosphereAmber: "rgba(245, 158, 11, 0.04)",
    atmosphereNeutral: "rgba(15, 23, 42, 0.04)",
    border: "#CBD5E1",
    borderSubtle: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textTertiary: "#64748B",
    textMuted: "#94A3B8",
    inputBackground: "#FFFFFF",
    inputBorder: "#CBD5E1",
    inputPlaceholder: "#94A3B8",
    buttonPrimaryBackground: "#0F172A",
    buttonPrimaryText: "#FFFFFF",
    buttonSecondaryBackground: "#E2E8F0",
    buttonSecondaryText: "#0F172A",
    accentSoft: "#E2E8F0",
    errorSurface: "#FEF2F2",
    errorBorder: "#FECACA",
    errorText: "#B91C1C",
    skeleton: "#E2E8F0",
    tabBarBackground: "#FFFFFF",
    tabBarBorder: "#E2E8F0",
    tabBarActive: "#0F172A",
    tabBarInactive: "#94A3B8",
  },
  dark: {
    background: "#080810",
    backgroundMuted: "#0C0C18",
    surface: "#12121E",
    surfaceMuted: "#0F0F1A",
    surfaceStrong: "#1A1A2E",
    atmosphereTeal: "rgba(13, 148, 136, 0.06)",
    atmosphereAmber: "rgba(245, 158, 11, 0.04)",
    atmosphereNeutral: "rgba(100, 116, 139, 0.06)",
    border: "rgba(255,255,255,0.08)",
    borderSubtle: "rgba(255,255,255,0.05)",
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    textTertiary: "#64748B",
    textMuted: "#475569",
    inputBackground: "#12121E",
    inputBorder: "rgba(255,255,255,0.08)",
    inputPlaceholder: "#475569",
    buttonPrimaryBackground: "#F1F5F9",
    buttonPrimaryText: "#080810",
    buttonSecondaryBackground: "rgba(255,255,255,0.06)",
    buttonSecondaryText: "#F1F5F9",
    accentSoft: "rgba(255,255,255,0.05)",
    errorSurface: "rgba(239,68,68,0.10)",
    errorBorder: "rgba(239,68,68,0.20)",
    errorText: "#FCA5A5",
    skeleton: "rgba(255,255,255,0.05)",
    tabBarBackground: "#080810",
    tabBarBorder: "rgba(255,255,255,0.05)",
    tabBarActive: "#F1F5F9",
    tabBarInactive: "#475569",
  },
};

export function resolveAppTheme(
  preference: ThemePreference,
  systemTheme: AppTheme,
): AppTheme {
  if (preference === "system") {
    return systemTheme;
  }

  return preference;
}

export function statusBarStyleForTheme(theme: AppTheme): AppStatusBarStyle {
  return theme === "dark" ? "light" : "dark";
}
