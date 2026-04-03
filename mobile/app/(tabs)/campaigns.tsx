import { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Layers } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { ProfileSetupCard } from "../../components/profile-setup-card";
import { formatCampaignDate } from "../../lib/campaign-formatters";
import {
  type ApplicationRecord,
  type MembershipRecord,
} from "../../lib/creator-campaigns";
import { decideCreatorHomeState } from "../../lib/creator-home-state";
import { loadCreatorWorkspace } from "../../lib/creator-workspace";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

type Tab = "active" | "completed" | "applications";
type CampaignListItem = MembershipRecord | ApplicationRecord;

const TABS: Tab[] = ["active", "completed", "applications"];

function getApplicationStatusLabel(
  status: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case "pending":
      return t("campaigns.status.pending");
    case "counter_offer":
      return t("campaigns.status.counterOffer");
    case "accepted":
      return t("campaigns.status.accepted");
    case "rejected":
      return t("campaigns.status.rejected");
    case "withdrawn":
      return t("campaigns.status.withdrawn");
    default:
      return status;
  }
}

function isApplicationRecord(
  item: CampaignListItem,
): item is ApplicationRecord {
  return "campaignTitle" in item;
}

export default function CampaignsScreen() {
  const { session, profile, profileReady } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [activeCampaigns, setActiveCampaigns] = useState<MembershipRecord[]>([]);
  const [completedCampaigns, setCompletedCampaigns] = useState<
    MembershipRecord[]
  >([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const homeState = decideCreatorHomeState(profile?.status ?? null);

  useEffect(() => {
    if (
      homeState !== "workspace" ||
      !profileReady ||
      !session?.user?.id
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setHasError(false);

      try {
        const workspace = await loadCreatorWorkspace(session.user.id);
        if (!cancelled) {
          setActiveCampaigns(workspace.campaigns.active);
          setCompletedCampaigns(workspace.campaigns.completed);
          setApplications(workspace.campaigns.applications);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [homeState, profileReady, session?.user?.id]);

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

  const activeData: CampaignListItem[] =
    activeTab === "active"
      ? activeCampaigns
      : activeTab === "completed"
        ? completedCampaigns
        : applications;
  const surfaceCardStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.borderSubtle,
  };
  const mutedCardStyle = {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.borderSubtle,
  };
  const chipStyle = {
    backgroundColor: palette.accentSoft,
  };

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      <View className="px-6 pt-6">
        <Text
          className="text-[28px] tracking-tight"
          style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
        >
          {t("campaigns.title")}
        </Text>

        {/* Tab pills */}
        <View className="mt-5 flex-row gap-2">
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`rounded-full px-5 py-2.5 ${
                activeTab === tab ? "" : "border"
              }`}
              style={
                activeTab === tab
                  ? { backgroundColor: palette.buttonPrimaryBackground }
                  : {
                      backgroundColor: palette.surface,
                      borderColor: palette.inputBorder,
                    }
              }
            >
              <Text
                className="text-sm"
                style={{
                  color:
                    activeTab === tab
                      ? palette.buttonPrimaryText
                      : palette.textTertiary,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {tabLabel(tab)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Campaign list */}
      {homeState !== "workspace" ? (
        <View className="flex-1 px-6">
          <ProfileSetupCard onPress={() => router.push("/(tabs)/profile")} />
        </View>
      ) : (
        <FlatList<CampaignListItem>
        data={activeData}
        keyExtractor={(item) => (isApplicationRecord(item) ? item.id : item.campaignId)}
        renderItem={({ item }) => {
          if (isApplicationRecord(item)) {
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/campaign/[id]",
                    params: {
                      id: item.campaignId,
                      title: item.campaignTitle,
                      brandName: item.brandName,
                      platforms: item.platforms.join(","),
                      applicationStatus: item.status,
                    },
                  })
                }
                className="mb-3 rounded-2xl border px-5 py-4"
                style={surfaceCardStyle}
              >
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text
                      className="text-base"
                      style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
                    >
                      {item.campaignTitle}
                    </Text>
                    <Text
                      className="mt-1 text-sm"
                      style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
                    >
                      {item.brandName}
                    </Text>
                  </View>
                  <View
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: palette.buttonPrimaryBackground }}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: palette.buttonPrimaryText,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {getApplicationStatusLabel(item.status, t)}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {item.platforms.map((platform) => (
                    <View
                      key={platform}
                      className="rounded-full px-3 py-1"
                      style={chipStyle}
                    >
                      <Text
                        className="text-xs uppercase"
                        style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
                      >
                        {platform}
                      </Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          }

          const detailLabel =
            activeTab === "completed"
              ? t("campaigns.completedOn", {
                  date: formatCampaignDate(item.completedAt, locale) ?? "—",
                })
              : t("campaigns.due", {
                  date: formatCampaignDate(item.contentDueDate, locale) ?? "—",
                });

          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/campaign/[id]",
                  params: {
                    id: item.campaignId,
                    title: item.title,
                    brandName: item.brandName,
                    platforms: item.platforms.join(","),
                  },
                })
              }
              className="mb-3 rounded-2xl border px-5 py-4"
              style={surfaceCardStyle}
            >
              <Text
                className="text-base"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {item.title}
              </Text>
              <Text
                className="mt-1 text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
              >
                {item.brandName}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {item.platforms.map((platform) => (
                  <View
                    key={platform}
                    className="rounded-full px-3 py-1"
                    style={chipStyle}
                  >
                    <Text
                      className="text-xs uppercase"
                      style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
                    >
                      {platform}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                className="mt-4 text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
              >
                {detailLabel}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
        ListEmptyComponent={
          loading ? (
            <View className="pt-4 pb-10">
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  className="mb-3 rounded-2xl border px-5 py-5"
                  style={mutedCardStyle}
                >
                  <View
                    className="h-4 w-40 rounded-full"
                    style={{ backgroundColor: palette.skeleton }}
                  />
                  <View
                    className="mt-3 h-3 w-24 rounded-full"
                    style={{ backgroundColor: palette.surfaceStrong }}
                  />
                  <View
                    className="mt-4 h-12 rounded-2xl"
                    style={{ backgroundColor: palette.surfaceStrong }}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <View
                className="mb-5 h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle }}
              >
                <Layers size={22} color={palette.textMuted} strokeWidth={1.5} />
              </View>
              <Text
                className="text-base"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {hasError
                  ? t("error.generic")
                  : activeTab === "active"
                    ? t("campaigns.empty")
                    : activeTab === "completed"
                      ? t("campaigns.emptyCompleted")
                      : t("campaigns.emptyApplications")}
              </Text>
              <Text
                className="mt-1.5 text-center text-sm"
                style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
              >
                {hasError
                  ? t("error.network")
                  : activeTab === "active"
                    ? t("campaigns.emptyDetail")
                    : activeTab === "completed"
                      ? t("campaigns.emptyCompletedDetail")
                      : t("campaigns.emptyApplicationsDetail")}
              </Text>
              <Pressable
                onPress={() => router.push("/(tabs)/discover")}
                className="mt-6 rounded-xl px-8 py-3.5"
                style={{ backgroundColor: palette.buttonPrimaryBackground }}
              >
                <Text
                  className="text-sm"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("campaigns.browse")}
                </Text>
              </Pressable>
            </View>
          )
        }
      />
      )}
    </SafeAreaView>
  );
}
