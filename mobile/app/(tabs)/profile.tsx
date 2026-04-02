import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Star,
  Clock,
  Briefcase,
  User,
  LogOut,
  ChevronRight,
  Plus,
} from "lucide-react-native";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

const PLATFORMS = [
  { name: "TikTok", color: "#000000" },
  { name: "Instagram", color: "#E4405F" },
  { name: "Snapchat", color: "#FFFC00" },
  { name: "YouTube", color: "#FF0000" },
  { name: "Facebook", color: "#1877F2" },
];

// Placeholder niches — will come from creator_profiles.niches in DB
const PLACEHOLDER_NICHES = ["beauty", "fashion", "lifestyle"] as const;

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();

  const displayName = profile?.full_name || t("profile.tierNew");
  const hasName = !!profile?.full_name;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="items-center px-6 pt-8 pb-6">
          {/* Avatar */}
          <View className="h-20 w-20 items-center justify-center rounded-full bg-slate-100">
            <User size={32} color="#94A3B8" />
          </View>

          {/* Name */}
          <Text
            className="mt-4 text-xl text-slate-900"
            style={{ fontFamily: "Inter_700Bold" }}
          >
            {displayName}
          </Text>

          {/* Tier badge — only show if user has a name (not the fallback) */}
          {hasName && (
            <View className="mt-2 rounded-full bg-slate-100 px-3 py-1">
              <Text
                className="text-xs text-slate-500"
                style={{ fontFamily: "Inter_500Medium" }}
              >
                {t("profile.tierNew")}
              </Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View className="mx-6 flex-row rounded-2xl bg-slate-50 p-4">
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Star size={14} color="#0F172A" />
              <Text
                className="text-lg text-slate-900"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                —
              </Text>
            </View>
            <Text
              className="mt-1 text-xs text-slate-400"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("profile.rating")}
            </Text>
          </View>
          <View className="w-px bg-slate-200" />
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Briefcase size={14} color="#0F172A" />
              <Text
                className="text-lg text-slate-900"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                0
              </Text>
            </View>
            <Text
              className="mt-1 text-xs text-slate-400"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("profile.campaigns")}
            </Text>
          </View>
          <View className="w-px bg-slate-200" />
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#0F172A" />
              <Text
                className="text-lg text-slate-900"
                style={{ fontFamily: "Inter_600SemiBold" }}
              >
                —
              </Text>
            </View>
            <Text
              className="mt-1 text-xs text-slate-400"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("profile.response")}
            </Text>
          </View>
        </View>

        {/* Social Accounts */}
        <View className="mx-6 mt-8">
          <Text
            className="text-sm font-medium uppercase tracking-wider text-slate-400"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {t("profile.socialAccounts")}
          </Text>
          <View className="mt-3 gap-2">
            {PLATFORMS.map((platform) => (
              <Pressable
                key={platform.name}
                className="flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5"
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <Text
                    className="text-sm text-slate-900"
                    style={{ fontFamily: "Inter_500Medium" }}
                  >
                    {platform.name}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Plus size={14} color="#94A3B8" />
                  <Text
                    className="text-xs text-slate-400"
                    style={{ fontFamily: "Inter_400Regular" }}
                  >
                    {t("action.connect")}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Niches */}
        <View className="mx-6 mt-8">
          <Text
            className="text-sm font-medium uppercase tracking-wider text-slate-400"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {t("profile.niches")}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {PLACEHOLDER_NICHES.map((niche) => (
              <View
                key={niche}
                className="rounded-full bg-slate-50 px-4 py-2"
              >
                <Text
                  className="text-sm text-slate-600"
                  style={{ fontFamily: "Inter_400Regular" }}
                >
                  {t(`niche.${niche}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rate Card */}
        <View className="mx-6 mt-8">
          <Text
            className="text-sm font-medium uppercase tracking-wider text-slate-400"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {t("profile.rateCard")}
          </Text>
          <Pressable className="mt-3 flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
            <Text
              className="text-sm text-slate-400"
              style={{ fontFamily: "Inter_400Regular" }}
            >
              {t("profile.noRates")}
            </Text>
            <ChevronRight size={16} color="#94A3B8" />
          </Pressable>
        </View>

        {/* Edit Profile */}
        <View className="mx-6 mt-10">
          <Pressable className="items-center rounded-xl bg-slate-900 px-6 py-3.5">
            <Text
              className="text-sm text-white"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("profile.editProfile")}
            </Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <Pressable
          onPress={signOut}
          className="mx-6 mb-10 mt-4 items-center py-3"
        >
          <Text
            className="text-sm text-slate-400"
            style={{ fontFamily: "Inter_500Medium" }}
          >
            {t("action.signOut")}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
