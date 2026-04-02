import { useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Briefcase } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useI18n } from "../../lib/i18n";

type Tab = "active" | "completed" | "applications";

const TABS: Tab[] = ["active", "completed", "applications"];

export default function CampaignsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("active");

  // Placeholder data — will be replaced with real API calls
  const campaigns: unknown[] = [];

  function tabLabel(tab: Tab): string {
    switch (tab) {
      case "active":
        return t("campaigns.active");
      case "completed":
        return t("campaigns.completed");
      case "applications":
        return t("campaigns.applications");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-6 pt-4">
        <Text
          className="text-2xl text-slate-900"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {t("campaigns.title")}
        </Text>

        {/* Tab pills */}
        <View className="mt-4 flex-row gap-2">
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 ${
                activeTab === tab
                  ? "bg-slate-900"
                  : "border border-slate-300 bg-white"
              }`}
            >
              <Text
                className={`text-sm ${
                  activeTab === tab ? "text-white" : "text-slate-600"
                }`}
                style={{ fontFamily: "Inter_500Medium" }}
              >
                {tabLabel(tab)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Campaign list */}
      <FlatList
        data={campaigns}
        keyExtractor={(_, index) => index.toString()}
        renderItem={() => null}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center">
            <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-slate-50">
              <Briefcase size={24} color="#94A3B8" />
            </View>
            <Text
              className="text-base text-slate-900"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("campaigns.empty")}
            </Text>
            <Text
              className="mt-1.5 text-center text-sm text-slate-400"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("campaigns.emptyDetail")}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/discover")}
              className="mt-6 rounded-xl bg-slate-900 px-8 py-3.5"
            >
              <Text
                className="text-sm text-white"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {t("campaigns.browse")}
              </Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}
