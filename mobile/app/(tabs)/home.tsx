import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sparkles, ArrowRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const timeOfDay = getTimeOfDay();
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Text
          className="mt-6 text-2xl text-slate-900"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {firstName
            ? t("home.greetingName", {
                timeOfDay: t(`home.${timeOfDay}`),
                name: firstName,
              })
            : t("home.greeting", {
                timeOfDay: t(`home.${timeOfDay}`),
              })}
        </Text>

        {/* Status line */}
        <Text
          className="mt-1.5 text-base text-slate-400"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {!profile?.status || profile.status !== "active"
            ? t("home.statusSetup")
            : t("home.statusClear")}
        </Text>

        {/* Empty state — profile incomplete */}
        {!profile?.status || profile.status !== "active" ? (
          <View className="mt-10 rounded-2xl border border-slate-100 bg-slate-50/50 px-6 py-10 items-center">
            <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-slate-900">
              <Sparkles size={24} color="#FFFFFF" />
            </View>
            <Text
              className="text-lg text-slate-900 text-center"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("home.empty")}
            </Text>
            <Text
              className="mt-2 text-center text-sm text-slate-400 leading-5"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("home.emptyDetail")}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              className="mt-6 flex-row items-center rounded-xl bg-slate-900 px-7 py-3.5"
            >
              <Text
                className="text-sm text-white"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                {t("home.completeProfile")}
              </Text>
              <ArrowRight size={16} color="#FFFFFF" className="ms-2" />
            </Pressable>
          </View>
        ) : (
          <View className="mt-6">
            {/* Action Required section */}
            <Text
              className="text-lg text-slate-900"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("home.actionRequired")}
            </Text>
            <View className="mt-3 rounded-xl border border-slate-100 p-4">
              <Text
                className="text-sm text-slate-500"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                {t("home.emptyDetail")}
              </Text>
            </View>

            {/* Campaigns For You */}
            <Text
              className="mt-8 text-lg text-slate-900"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("home.newMatches")}
            </Text>
            <View className="mt-3 rounded-xl border border-slate-100 p-4">
              <Text
                className="text-sm text-slate-500"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                {t("discover.empty")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
