import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import {
  resolveAppTheme,
  statusBarStyleForTheme,
  themePalettes,
  type AppStatusBarStyle,
  type AppTheme,
  type ThemePalette,
  type ThemePreference,
} from "./theme";
import {
  readStoredThemePreference,
  writeStoredThemePreference,
} from "./preferences-data";

type ThemeContextValue = {
  theme: AppTheme;
  systemTheme: AppTheme;
  preference: ThemePreference;
  palette: ThemePalette;
  statusBarStyle: AppStatusBarStyle;
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const systemTheme: AppTheme = colorScheme === "dark" ? "dark" : "light";
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  const theme = resolveAppTheme(preference, systemTheme);
  const palette = themePalettes[theme];
  const statusBarStyle = statusBarStyleForTheme(theme);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedPreference = await readStoredThemePreference();

      if (cancelled) {
        return;
      }

      if (storedPreference) {
        setPreference(storedPreference);
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.background);
  }, [palette.background]);

  async function updatePreference(nextPreference: ThemePreference) {
    setPreference(nextPreference);
    await writeStoredThemePreference(nextPreference);
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        systemTheme,
        preference,
        palette,
        statusBarStyle,
        ready,
        setPreference: (nextPreference) => {
          void updatePreference(nextPreference);
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
