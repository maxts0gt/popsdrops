import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";
import { useI18n } from "../../lib/i18n";

type Tab = "forYou" | "browseAll";

const TABS: Tab[] = ["forYou", "browseAll"];

export default function DiscoverScreen() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("forYou");
  const [search, setSearch] = useState("");

  // Placeholder data — will be replaced with real API calls
  const campaigns: unknown[] = [];

  function tabLabel(tab: Tab): string {
    switch (tab) {
      case "forYou":
        return t("discover.forYou");
      case "browseAll":
        return t("discover.browseAll");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="px-6 pt-4 pb-2">
        <Text
          className="text-2xl text-slate-900"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {t("discover.title")}
        </Text>

        {/* Search bar */}
        <View className="mt-4 flex-row items-center rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-3">
          <Search size={18} color="#64748B" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("discover.search")}
            placeholderTextColor="#94A3B8"
            className="ms-3 flex-1 text-base text-slate-900"
            style={{ fontFamily: "Inter_400Regular" }}
          />
        </View>

        {/* Tab pills */}
        <View className="mt-4 flex-row gap-2">
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2 ${
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
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
        ListEmptyComponent={
          <View className="items-center pt-24 pb-20">
            <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Search size={28} color="#64748B" />
            </View>
            <Text
              className="text-base text-slate-900"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("discover.empty")}
            </Text>
            <Text
              className="mt-2 max-w-[260px] text-center text-sm text-slate-500"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("discover.emptyDetail")}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
