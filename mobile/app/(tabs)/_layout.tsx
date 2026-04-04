import { Redirect, Tabs } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Compass, Layers, DollarSign, User } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { decideMobileAccess } from "../../lib/access-policy";
import { AccessStateScreen } from "../../components/access-state-screen";
import { useTheme } from "../../lib/theme-context";

const TAB_BAR_HEIGHT = 56;
const TAB_BAR_MARGIN_H = 32;
const TAB_BAR_RADIUS = 28;

const ICONS: Record<string, typeof Home> = {
  home: Home,
  discover: Compass,
  campaigns: Layers,
  earnings: DollarSign,
  profile: User,
};

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { palette, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme === "dark";
  const bottomOffset = Math.max(insets.bottom - 10, 12);

  return (
    <View
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: TAB_BAR_MARGIN_H,
        right: TAB_BAR_MARGIN_H,
        height: TAB_BAR_HEIGHT,
        borderRadius: TAB_BAR_RADIUS,
        overflow: "hidden",
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.5 : 0.15,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      {/* Base color layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? "rgba(12,12,24,0.92)"
              : "rgba(205,222,248,0.82)",
          },
        ]}
      />
      {/* Blur for frosted glass */}
      <BlurView
        intensity={Platform.OS === "ios" ? 50 : 70}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      {/* Tint overlay */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? "rgba(13,148,136,0.03)"
              : "rgba(240,248,255,0.40)",
          },
        ]}
      />
      {/* Inner highlight border */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: TAB_BAR_RADIUS,
            borderWidth: isDark ? 0.5 : 0.5,
            borderColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(255,255,255,0.95)",
          },
        ]}
      />

      {/* Tab icons */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingHorizontal: 8,
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const Icon = ICONS[route.name] ?? Home;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel
                ?? (typeof options.title === "string" ? options.title : undefined)
                ?? route.name
              }
              onPress={onPress}
              onLongPress={onLongPress}
              hitSlop={8}
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
              }}
            >
              <Icon
                size={22}
                color={
                  isFocused ? palette.tabBarActive : palette.tabBarInactive
                }
                strokeWidth={isFocused ? 2.2 : 1.5}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();
  const { session, profile, loading, profileReady } = useAuth();
  const access = decideMobileAccess({
    loading,
    hasSession: !!session,
    profileReady,
    role: profile?.role ?? null,
    status: profile?.status ?? null,
  });

  if (access.kind === "loading") {
    return <AccessStateScreen mode="loading" />;
  }

  if (access.kind === "blocked") {
    return <AccessStateScreen mode={access.reason} />;
  }

  if (access.href === "/(auth)/login") {
    return <Redirect href={access.href} />;
  }

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" options={{ title: t("tab.home") }} />
      <Tabs.Screen name="discover" options={{ title: t("tab.discover") }} />
      <Tabs.Screen name="campaigns" options={{ title: t("tab.campaigns") }} />
      <Tabs.Screen name="earnings" options={{ title: t("tab.earnings") }} />
      <Tabs.Screen name="profile" options={{ title: t("tab.profile") }} />
    </Tabs>
  );
}
