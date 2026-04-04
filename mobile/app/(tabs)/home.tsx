import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Bell,
  Layers,
  Clock,
  Star,
  FileEdit,
  ArrowRight,
  Search,
  AlertTriangle,
  Sparkles,
  CheckCircle,
} from "lucide-react-native";
import { ProfileSetupCard } from "../../components/profile-setup-card";
import { ScreenCanvas } from "../../components/screen-canvas";
import { useAuth } from "../../lib/auth";
import { formatCampaignBudget } from "../../lib/campaign-formatters";
import { decideCreatorHomeState } from "../../lib/creator-home-state";
import {
  loadCreatorWorkspace,
  type CreatorWorkspaceSnapshot,
} from "../../lib/creator-workspace";
import { getUnreadCount } from "../../lib/notifications";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

type ActionItem = {
  id: string;
  type: "due" | "counter";
  title: string;
  subtitle: string;
  detail: string;
};

function buildActionItems(
  workspace: CreatorWorkspaceSnapshot,
  t: (key: string, vars?: Record<string, string>) => string,
): ActionItem[] {
  const items: ActionItem[] = [];

  // Counter offers — high priority
  for (const app of workspace.campaigns.applications) {
    if (app.status === "counter_offer" && app.counterRate != null) {
      items.push({
        id: app.id,
        type: "counter",
        title: t("home.counterOffer", { rate: `$${app.counterRate}` }),
        subtitle: `${app.campaignTitle} · ${app.brandName}`,
        detail: t("home.counterDetail", {
          rate: `$${app.proposedRate ?? 0}`,
        }),
      });
    }
  }

  // Approaching deadlines
  for (const m of workspace.campaigns.active) {
    if (m.contentDueDate) {
      const daysLeft = Math.ceil(
        (new Date(m.contentDueDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysLeft >= 0 && daysLeft <= 5) {
        items.push({
          id: m.campaignId,
          type: "due",
          title:
            daysLeft === 0
              ? t("home.dueToday")
              : t("home.dueSoon", { days: String(daysLeft) }),
          subtitle: `${m.title} · ${m.brandName}`,
          detail: "",
        });
      }
    }
  }

  return items;
}

export default function HomeScreen() {
  const { session, profile, profileReady } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const userId = session?.user?.id ?? null;
  const timeOfDay = getTimeOfDay();
  const firstName = profile?.full_name?.split(" ")[0];
  const homeState = decideCreatorHomeState(profile?.status ?? null);

  const [workspace, setWorkspace] = useState<CreatorWorkspaceSnapshot | null>(
    null,
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (homeState !== "workspace" || !profileReady || !userId) return;
    try {
      const [nextWorkspace, count] = await Promise.all([
        loadCreatorWorkspace(userId),
        getUnreadCount(userId),
      ]);
      setWorkspace(nextWorkspace);
      setUnreadCount(count);
      setWorkspaceError(false);
    } catch {
      setWorkspaceError(true);
    }
  }, [homeState, profileReady, userId]);

  useEffect(() => {
    void (async () => {
      setWorkspaceLoading(true);
      await fetchData();
      setWorkspaceLoading(false);
    })();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const actions = workspace ? buildActionItems(workspace, t) : [];

  return (
    <ScreenCanvas>
      <SafeAreaView
        className="flex-1"
        edges={["top"]}
        style={{ backgroundColor: "transparent" }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.textMuted} />
          }
        >
          {/* ── Greeting ── */}
          <View className="px-6 pt-10">
            <View className="flex-row items-start justify-between">
            <Text
              className="flex-1 text-[32px] leading-[38px] tracking-tight"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
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
            <Pressable
              onPress={() => router.push("/notifications")}
              hitSlop={12}
              className="relative mt-2"
            >
              <Bell size={22} color={palette.textTertiary} strokeWidth={1.6} />
              {unreadCount > 0 ? (
                <View
                  className="absolute -top-1 -right-1 h-4 min-w-[16px] items-center justify-center rounded-full px-1"
                  style={{ backgroundColor: "#EF4444" }}
                >
                  <Text
                    className="text-[10px]"
                    style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold" }}
                  >
                    {unreadCount > 9 ? "9+" : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            </View>
            <Text
              className="mt-2 text-[15px]"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {homeState !== "workspace"
                ? t("home.statusSetup")
                : t("home.subtitle")}
            </Text>
          </View>

          {homeState !== "workspace" ? (
            <View className="px-6">
              <ProfileSetupCard
                onPress={() => router.push("/(tabs)/profile")}
              />
            </View>
          ) : workspaceLoading || !workspace ? (
            <SkeletonState palette={palette} />
          ) : workspaceError ? (
            <View className="mx-6 mt-6">
              <View
                className="rounded-2xl px-5 py-5"
                style={{
                  backgroundColor: palette.errorSurface,
                  borderWidth: 1,
                  borderColor: palette.errorBorder,
                }}
              >
                <Text
                  className="text-sm"
                  style={{
                    color: palette.errorText,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  {t("error.generic")}
                </Text>
              </View>
            </View>
          ) : (
            <WorkspaceContent
              workspace={workspace!}
              actions={actions}
              palette={palette}
              t={t}
              locale={locale}
              router={router}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenCanvas>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace content — the main home screen for active creators
// ─────────────────────────────────────────────────────────────────────────────

function WorkspaceContent({
  workspace,
  actions,
  palette,
  t,
  locale,
  router,
}: {
  workspace: CreatorWorkspaceSnapshot;
  actions: ActionItem[];
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
  router: ReturnType<typeof useRouter>;
}) {
  const { home } = workspace;

  const stats = [
    {
      label: t("home.activeCampaigns"),
      value: String(home.activeCampaignCount),
      icon: Layers,
    },
    {
      label: t("home.pendingApplications"),
      value: String(home.pendingApplicationCount),
      icon: Clock,
    },
    {
      label: t("home.counterOffers"),
      value: String(home.counterOfferCount),
      icon: FileEdit,
    },
    {
      label: t("home.rating"),
      value: "—",
      icon: Star,
    },
  ];

  return (
    <View className="mt-8">
      {/* ── Quick Stats ── */}
      <View className="flex-row gap-2.5 px-6">
        {stats.map((stat) => (
          <View
            key={stat.label}
            className="flex-1 items-center rounded-2xl py-5"
            style={{
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <stat.icon
              size={15}
              color={palette.textMuted}
              strokeWidth={1.6}
            />
            <Text
              className="mt-2.5 text-[22px]"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
            >
              {stat.value}
            </Text>
            <Text
              className="mt-1.5 text-[9px] uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_500Medium",
              }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Action Required ── */}
      {actions.length > 0 ? (
        <View className="mt-10 px-6">
          <SectionHeader label={t("home.actionRequired")} palette={palette} />
          <View className="mt-4 gap-3">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                palette={palette}
                onPress={() => router.push("/(tabs)/campaigns")}
              />
            ))}
          </View>
        </View>
      ) : (
        <View className="mt-10 px-6">
          <View
            className="items-center rounded-2xl px-6 py-10"
            style={{
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <View
              className="mb-4 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.surfaceStrong }}
            >
              <CheckCircle size={20} color={palette.textMuted} strokeWidth={1.6} />
            </View>
            <Text
              className="text-[15px]"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("home.noTasks")}
            </Text>
            <Text
              className="mt-2 text-sm"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("home.noTasksDetail")}
            </Text>
          </View>
        </View>
      )}

      {/* ── Recommended Campaigns ── */}
      <View className="mt-10 px-6">
        <View className="flex-row items-center justify-between">
          <SectionHeader label={t("home.topMatches")} palette={palette} />
          <Pressable onPress={() => router.push("/(tabs)/discover")}>
            <Text
              className="text-xs"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_500Medium",
              }}
            >
              {t("home.seeAll")}
            </Text>
          </Pressable>
        </View>

        {home.topMatches.length > 0 ? (
          <View className="mt-4 gap-3">
            {home.topMatches.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                palette={palette}
                t={t}
                locale={locale}
                onPress={() =>
                  router.push({
                    pathname: "/campaign/[id]",
                    params: {
                      id: campaign.id,
                      title: campaign.title,
                      brandName: campaign.brandName,
                      platforms: campaign.platforms.join(","),
                      budgetMin: campaign.budgetMin != null ? String(campaign.budgetMin) : "",
                      budgetMax: campaign.budgetMax != null ? String(campaign.budgetMax) : "",
                      budgetCurrency: campaign.budgetCurrency,
                      applicationDeadline: campaign.applicationDeadline ?? "",
                      matchScore: String(campaign.matchScore),
                      niches: campaign.niches?.join(",") ?? "",
                      markets: campaign.markets?.join(",") ?? "",
                    },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View
            className="mt-3 items-center rounded-2xl px-5 py-8"
            style={{
              backgroundColor: palette.surfaceMuted,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <View
              className="mb-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.surfaceStrong }}
            >
              <Search size={18} color={palette.textMuted} strokeWidth={1.8} />
            </View>
            <Text
              className="text-sm"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("discover.empty")}
            </Text>
            <Text
              className="mt-1 text-center text-xs"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("discover.emptyDetail")}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/discover")}
              className="mt-4 flex-row items-center rounded-xl px-5 py-3"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <Search
                size={14}
                color={palette.buttonPrimaryText}
                strokeWidth={2}
              />
              <Text
                className="ms-2 text-sm"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("home.exploreCampaigns")}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  palette,
}: {
  label: string;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <Text
      className="text-[11px] uppercase tracking-[1.6px]"
      style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
    >
      {label}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action card — urgency items with colored left accent
// ─────────────────────────────────────────────────────────────────────────────

function ActionCard({
  action,
  palette,
  onPress,
}: {
  action: ActionItem;
  palette: ReturnType<typeof useTheme>["palette"];
  onPress: () => void;
}) {
  const accentColor = action.type === "due" ? "#EF4444" : palette.textPrimary;
  const Icon = action.type === "due" ? AlertTriangle : FileEdit;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start overflow-hidden rounded-2xl"
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      }}
    >
      {/* Colored accent bar */}
      <View style={{ width: 3, alignSelf: "stretch", backgroundColor: accentColor }} />

      <View className="flex-1 flex-row items-start gap-3 px-4 py-4">
        <View
          className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: palette.surfaceMuted }}
        >
          <Icon size={15} color={accentColor} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text
            className="text-sm"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            {action.title}
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{
              color: palette.textMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {action.subtitle}
          </Text>
          {action.detail ? (
            <Text
              className="mt-1 text-xs"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {action.detail}
            </Text>
          ) : null}
        </View>
        <ArrowRight
          size={16}
          color={palette.textMuted}
          strokeWidth={1.8}
          style={{ marginTop: 2 }}
        />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign card — recommended campaigns
// ─────────────────────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  palette,
  t,
  locale,
  onPress,
}: {
  campaign: CreatorWorkspaceSnapshot["home"]["topMatches"][number];
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
  onPress: () => void;
}) {
  const budget = formatCampaignBudget({
    budgetMin: campaign.budgetMin,
    budgetMax: campaign.budgetMax,
    budgetCurrency: campaign.budgetCurrency,
    locale,
  });

  const [now] = useState(() => Date.now());
  const daysLeft = campaign.applicationDeadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(campaign.applicationDeadline).getTime() - now) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl px-5 py-4"
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pe-3">
          <Text
            className="text-[15px]"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_600SemiBold",
            }}
            numberOfLines={2}
          >
            {campaign.title}
          </Text>
          <Text
            className="mt-1 text-xs"
            style={{
              color: palette.textTertiary,
              fontFamily: "Inter_400Regular",
            }}
          >
            {campaign.brandName}
          </Text>
        </View>
        <ArrowRight
          size={16}
          color={palette.textMuted}
          strokeWidth={1.8}
          style={{ marginTop: 3 }}
        />
      </View>

      {/* Meta row — platforms, budget, deadline */}
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {campaign.platforms.slice(0, 3).map((platform) => (
          <View
            key={platform}
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: palette.surfaceStrong }}
          >
            <Text
              className="text-[10px] uppercase tracking-[0.8px]"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {platform}
            </Text>
          </View>
        ))}

        {budget ? (
          <Text
            className="text-xs"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            {budget}
          </Text>
        ) : null}

        {daysLeft !== null ? (
          <Text
            className="text-xs"
            style={{
              color: daysLeft <= 3 ? "#EF4444" : palette.textMuted,
              fontFamily:
                daysLeft <= 3 ? "Inter_600SemiBold" : "Inter_400Regular",
            }}
          >
            {t("home.daysLeft", { count: String(daysLeft) })}
          </Text>
        ) : null}
      </View>

      {/* Recommended badge */}
      {campaign.matchScore >= 60 ? (
        <View className="mt-3 flex-row items-center gap-1.5">
          <View
            className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
            style={{ backgroundColor: palette.atmosphereTeal }}
          >
            <Sparkles size={11} color={palette.textTertiary} strokeWidth={2} />
            <Text
              className="text-[11px]"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("discover.recommended")}
            </Text>
          </View>
          {campaign.matchReasons.slice(0, 2).map((reason: string) => (
            <View
              key={reason}
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: palette.atmosphereTeal }}
            >
              <Text
                className="text-[11px]"
                style={{
                  color: palette.textTertiary,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {reason === "niche"
                  ? t("discover.matchNiche")
                  : reason === "platform"
                    ? t("discover.matchPlatform")
                    : t("discover.matchMarket")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loading state
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonState({
  palette,
}: {
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View className="mt-6 px-6">
      {/* Stat skeletons */}
      <View className="flex-row gap-3">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className="flex-1 rounded-2xl px-3 py-4"
            style={{
              backgroundColor: palette.surfaceMuted,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <View
              className="h-4 w-4 rounded"
              style={{ backgroundColor: palette.skeleton }}
            />
            <View
              className="mt-3 h-7 w-8 rounded-lg"
              style={{ backgroundColor: palette.skeleton }}
            />
            <View
              className="mt-2 h-2 w-12 rounded"
              style={{ backgroundColor: palette.skeleton }}
            />
          </View>
        ))}
      </View>

      {/* Action skeleton */}
      <View className="mt-8">
        <View
          className="h-3 w-24 rounded"
          style={{ backgroundColor: palette.skeleton }}
        />
        <View className="mt-3 gap-3">
          {[0, 1].map((i) => (
            <View
              key={i}
              className="rounded-2xl px-5 py-4"
              style={{
                backgroundColor: palette.surfaceMuted,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <View className="flex-row items-start gap-3">
                <View
                  className="h-8 w-8 rounded-lg"
                  style={{ backgroundColor: palette.skeleton }}
                />
                <View className="flex-1">
                  <View
                    className="h-4 w-40 rounded"
                    style={{ backgroundColor: palette.skeleton }}
                  />
                  <View
                    className="mt-2 h-3 w-28 rounded"
                    style={{ backgroundColor: palette.skeleton }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Campaign skeleton */}
      <View className="mt-8">
        <View
          className="h-3 w-28 rounded"
          style={{ backgroundColor: palette.skeleton }}
        />
        <View className="mt-3 gap-3">
          {[0, 1].map((i) => (
            <View
              key={i}
              className="rounded-2xl px-5 py-4"
              style={{
                backgroundColor: palette.surfaceMuted,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <View
                className="h-4 w-36 rounded"
                style={{ backgroundColor: palette.skeleton }}
              />
              <View
                className="mt-2 h-3 w-20 rounded"
                style={{ backgroundColor: palette.skeleton }}
              />
              <View className="mt-3 flex-row gap-2">
                <View
                  className="h-5 w-16 rounded-full"
                  style={{ backgroundColor: palette.skeleton }}
                />
                <View
                  className="h-5 w-14 rounded-full"
                  style={{ backgroundColor: palette.skeleton }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
