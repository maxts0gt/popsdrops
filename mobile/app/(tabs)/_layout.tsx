import { Tabs } from "expo-router";
import { Home, Search, Briefcase, User } from "lucide-react-native";
import { useI18n } from "../../lib/i18n";

export default function TabLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0F172A",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F1F5F9",
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 6,
          height: 60,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tab.home"),
          tabBarIcon: ({ color, size }) => (
            <Home size={size - 2} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t("tab.discover"),
          tabBarIcon: ({ color, size }) => (
            <Search size={size - 2} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: t("tab.campaigns"),
          tabBarIcon: ({ color, size }) => (
            <Briefcase size={size - 2} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab.profile"),
          tabBarIcon: ({ color, size }) => (
            <User size={size - 2} color={color} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
