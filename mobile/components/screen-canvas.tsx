import React, { type ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../lib/theme-context";

export function ScreenCanvas({
  children,
  includeAtmosphere = true,
}: {
  children: ReactNode;
  includeAtmosphere?: boolean;
}) {
  const { palette, theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      {includeAtmosphere ? (
        <>
          <View
            pointerEvents="none"
            className="absolute -start-20 -top-14 rounded-full"
            style={{
              width: isDark ? 280 : 224,
              height: isDark ? 280 : 224,
              backgroundColor: isDark
                ? "rgba(13, 148, 136, 0.08)"
                : palette.atmosphereTeal,
              opacity: isDark ? 1 : 0.95,
            }}
          />
          <View
            pointerEvents="none"
            className="absolute -end-16 top-20 rounded-full"
            style={{
              width: isDark ? 240 : 192,
              height: isDark ? 240 : 192,
              backgroundColor: isDark
                ? "rgba(245, 158, 11, 0.05)"
                : palette.atmosphereAmber,
            }}
          />
          <View
            pointerEvents="none"
            className="absolute inset-x-8 top-12 rounded-full"
            style={{
              height: isDark ? 200 : 160,
              backgroundColor: isDark
                ? "rgba(100, 116, 139, 0.06)"
                : palette.atmosphereNeutral,
            }}
          />
        </>
      ) : null}

      <View className="flex-1">{children}</View>
    </View>
  );
}
