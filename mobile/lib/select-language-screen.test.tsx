import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("expo-router", () => ({
  useRouter: () => ({
    back: vi.fn(),
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("react-native", () => ({
  ActivityIndicator: () => <div>loading</div>,
  Pressable: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => <button {...props}>{children}</button>,
  ScrollView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TextInput: ({
    onChangeText,
    placeholderTextColor,
    value,
    ...props
  }: {
    onChangeText?: (value: string) => void;
    placeholderTextColor?: string;
    value?: string;
  } & Record<string, unknown>) => {
    void placeholderTextColor;

    return (
      <input
        {...props}
        value={value ?? ""}
        onChange={(event) => onChangeText?.(event.currentTarget.value)}
      />
    );
  },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react-native", () => ({
  Check: () => <svg />,
  ChevronLeft: () => <svg />,
  ChevronRight: () => <svg />,
  Search: () => <svg />,
}));

vi.mock("./auth", () => ({
  useAuth: () => ({
    session: null,
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("./i18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        {
          "action.back": "Back",
          "preferences.languageTitle": "Language",
          "preferences.languageSearch": "Search languages",
          "preferences.languagePinned": "Pinned",
          "preferences.languageSuggested": "Suggested",
          "preferences.languageAll": "All languages",
        } as Record<string, string>
      )[key] ?? key,
    locale: "en",
    setLocale: vi.fn(),
    deviceLocales: ["fr"],
  }),
}));

vi.mock("./theme-context", () => ({
  useTheme: () => ({
    palette: {
      background: "#020617",
      atmosphereTeal: "rgba(13, 148, 136, 0.14)",
      atmosphereAmber: "rgba(245, 158, 11, 0.1)",
      atmosphereNeutral: "rgba(148, 163, 184, 0.08)",
      surface: "#0F172A",
      surfaceMuted: "#111827",
      border: "#334155",
      borderSubtle: "#1E293B",
      inputBorder: "#334155",
      inputPlaceholder: "#64748B",
      textPrimary: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textTertiary: "#94A3B8",
      textMuted: "#64748B",
      accentSoft: "#1E293B",
    },
    theme: "dark",
  }),
}));

vi.mock("./preferences-data", () => ({
  persistProfileLocalePreference: vi.fn(),
}));

import SelectLanguageScreen from "../app/select-language";

describe("SelectLanguageScreen", () => {
  it("renders the language picker shell with pinned english access", () => {
    const markup = renderToStaticMarkup(<SelectLanguageScreen />);

    expect(markup).toContain("Language");
    expect(markup).toContain("Pinned");
    expect(markup).toContain("English");
  });
});
