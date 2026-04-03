import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Bookmark,
  BookmarkCheck,
  Clock,
  Sparkles,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { ProfileSetupCard } from "../../components/profile-setup-card";
import {
  formatCampaignBudget,
  formatCampaignDate,
} from "../../lib/campaign-formatters";
import {
  filterDiscoverFeed,
  applyDiscoverFilters,
  sortDiscoverFeed,
  countActiveFilters,
  EMPTY_FILTERS,
  type DiscoverCampaignCard,
  type DiscoverFilters,
  type SortMode,
  type MatchReason,
} from "../../lib/creator-campaigns";
import { decideCreatorHomeState } from "../../lib/creator-home-state";
import { loadCreatorWorkspace } from "../../lib/creator-workspace";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

type Tab = "forYou" | "browseAll";

const PLATFORM_OPTIONS = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
] as const;

const PLATFORM_DISPLAY: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  youtube: "YouTube",
  facebook: "Facebook",
};

const SORT_OPTIONS: SortMode[] = [
  "recommended",
  "newest",
  "highestPaying",
  "deadline",
];

const RECOMMENDED_THRESHOLD = 60;

function MatchReasonChip({
  reason,
  palette,
  t,
}: {
  reason: MatchReason;
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string) => string;
}) {
  const labels: Record<MatchReason, string> = {
    niche: t("discover.matchNiche"),
    platform: t("discover.matchPlatform"),
    market: t("discover.matchMarket"),
  };

  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: palette.atmosphereTeal }}
    >
      <Text
        className="text-[11px]"
        style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
      >
        {labels[reason]}
      </Text>
    </View>
  );
}

function CampaignCard({
  item,
  palette,
  t,
  locale,
  showMatchReasons,
  isSaved,
  onToggleSave,
}: {
  item: DiscoverCampaignCard;
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  showMatchReasons: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const budgetLabel =
    formatCampaignBudget({
      budgetMin: item.budgetMin,
      budgetMax: item.budgetMax,
      budgetCurrency: item.budgetCurrency,
      locale,
    }) ?? t("discover.budgetOnRequest");

  const deadlineLabel = formatCampaignDate(item.applicationDeadline, locale);
  const isRecommended =
    showMatchReasons && item.matchScore >= RECOMMENDED_THRESHOLD;

  // Calculate days left
  let daysLeft: number | null = null;
  if (item.applicationDeadline) {
    daysLeft = Math.ceil(
      (new Date(item.applicationDeadline).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
  }
  const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;

  return (
    <View
      className="mb-3 rounded-2xl border px-5 py-4"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.borderSubtle,
      }}
    >
      {/* Header: brand + status + save */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pe-3">
          <Text
            className="text-[13px]"
            style={{
              color: palette.textTertiary,
              fontFamily: "Inter_500Medium",
            }}
          >
            {item.brandName}
          </Text>
          <Text
            className="mt-1 text-[15px] leading-5"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_600SemiBold",
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          {item.applicationStatus ? (
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <Text
                className="text-[11px]"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {item.applicationStatus === "counter_offer"
                  ? t("discover.counterOffer")
                  : t("discover.appliedPending")}
              </Text>
            </View>
          ) : null}
          <Pressable onPress={onToggleSave} hitSlop={8}>
            {isSaved ? (
              <BookmarkCheck
                size={20}
                color={palette.textPrimary}
                strokeWidth={1.8}
              />
            ) : (
              <Bookmark
                size={20}
                color={palette.textMuted}
                strokeWidth={1.4}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* Platform chips */}
      <View className="mt-3 flex-row flex-wrap gap-1.5">
        {item.platforms.map((platform) => (
          <View
            key={platform}
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: palette.accentSoft }}
          >
            <Text
              className="text-[11px] uppercase"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {PLATFORM_DISPLAY[platform] ?? platform}
            </Text>
          </View>
        ))}
      </View>

      {/* Budget + deadline row */}
      <View className="mt-3.5 flex-row items-center justify-between">
        <Text
          className="text-[15px]"
          style={{
            color: palette.textPrimary,
            fontFamily: "Inter_700Bold",
          }}
        >
          {budgetLabel}
        </Text>
        {daysLeft !== null && daysLeft > 0 ? (
          <View className="flex-row items-center gap-1">
            <Clock
              size={13}
              color={isUrgent ? palette.errorText : palette.textMuted}
              strokeWidth={1.6}
            />
            <Text
              className="text-xs"
              style={{
                color: isUrgent ? palette.errorText : palette.textMuted,
                fontFamily: "Inter_500Medium",
              }}
            >
              {t("discover.daysLeft", { count: daysLeft })}
            </Text>
          </View>
        ) : deadlineLabel ? (
          <Text
            className="text-xs"
            style={{
              color: palette.textMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {deadlineLabel}
          </Text>
        ) : null}
      </View>

      {/* Match reasons or recommended badge */}
      {isRecommended ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
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
          {item.matchReasons.slice(0, 2).map((reason) => (
            <MatchReasonChip
              key={reason}
              reason={reason}
              palette={palette}
              t={t}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SortPicker({
  value,
  onChange,
  palette,
  t,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const sortLabels: Record<SortMode, string> = {
    recommended: t("discover.sortRecommended"),
    newest: t("discover.sortNewest"),
    highestPaying: t("discover.sortHighestPaying"),
    deadline: t("discover.sortDeadline"),
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.inputBorder,
        }}
      >
        <Text
          className="text-xs"
          style={{
            color: palette.textSecondary,
            fontFamily: "Inter_500Medium",
          }}
        >
          {sortLabels[value]}
        </Text>
        <ChevronDown size={14} color={palette.textTertiary} strokeWidth={1.8} />
      </Pressable>
      {open ? (
        <View
          className="absolute right-0 top-10 z-50 min-w-[180px] rounded-xl border py-1"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.borderSubtle,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              className="px-4 py-2.5"
              style={
                value === option
                  ? { backgroundColor: palette.accentSoft }
                  : undefined
              }
            >
              <Text
                className="text-sm"
                style={{
                  color:
                    value === option
                      ? palette.textPrimary
                      : palette.textSecondary,
                  fontFamily:
                    value === option ? "Inter_600SemiBold" : "Inter_400Regular",
                }}
              >
                {sortLabels[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  palette,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onApply: (filters: DiscoverFilters) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string) => string;
}) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const budgetOptions: {
    key: DiscoverFilters["budgetRange"];
    label: string;
  }[] = [
    { key: "any", label: t("discover.budgetAny") },
    { key: "under500", label: t("discover.budgetUnder500") },
    { key: "500to1k", label: t("discover.budget500to1k") },
    { key: "1kPlus", label: t("discover.budget1kPlus") },
  ];

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item)
      ? arr.filter((v) => v !== item)
      : [...arr, item];
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: palette.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b px-6 pb-4 pt-6"
          style={{ borderColor: palette.borderSubtle }}
        >
          <Text
            className="text-lg"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_700Bold",
            }}
          >
            {t("discover.filters")}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={palette.textSecondary} strokeWidth={1.8} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Platform filter */}
          <Text
            className="mt-6 text-sm"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            Platform
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((p) => {
              const selected = draft.platforms.includes(p);
              return (
                <Pressable
                  key={p}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      platforms: toggleArrayItem(draft.platforms, p),
                    })
                  }
                  className="rounded-full px-4 py-2.5"
                  style={{
                    backgroundColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBackground,
                    borderWidth: 1,
                    borderColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBorder,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: selected
                        ? palette.buttonPrimaryText
                        : palette.textPrimary,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {PLATFORM_DISPLAY[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Niche filter */}
          <Text
            className="mt-6 text-sm"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            {t("discover.nicheFilter")}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {NICHE_OPTIONS.map((niche) => {
              const selected = draft.niches.includes(niche.key);
              return (
                <Pressable
                  key={niche.key}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      niches: toggleArrayItem(draft.niches, niche.key),
                    })
                  }
                  className="rounded-full px-4 py-2.5"
                  style={{
                    backgroundColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBackground,
                    borderWidth: 1,
                    borderColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBorder,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: selected
                        ? palette.buttonPrimaryText
                        : palette.textPrimary,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {niche.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Budget filter */}
          <Text
            className="mt-6 text-sm"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_600SemiBold",
            }}
          >
            {t("discover.budgetFilter")}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {budgetOptions.map((opt) => {
              const selected = draft.budgetRange === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() =>
                    setDraft({ ...draft, budgetRange: opt.key })
                  }
                  className="rounded-full px-4 py-2.5"
                  style={{
                    backgroundColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBackground,
                    borderWidth: 1,
                    borderColor: selected
                      ? palette.buttonPrimaryBackground
                      : palette.inputBorder,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: selected
                        ? palette.buttonPrimaryText
                        : palette.textPrimary,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Bottom actions */}
        <View
          className="border-t px-6 pb-10 pt-4"
          style={{
            borderColor: palette.borderSubtle,
            backgroundColor: palette.background,
          }}
        >
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setDraft(EMPTY_FILTERS);
              }}
              className="flex-1 items-center rounded-xl border py-3.5"
              style={{ borderColor: palette.inputBorder }}
            >
              <Text
                className="text-sm"
                style={{
                  color: palette.textSecondary,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {t("discover.clearFilters")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              className="flex-[2] items-center rounded-xl py-3.5"
              style={{
                backgroundColor: palette.buttonPrimaryBackground,
              }}
            >
              <Text
                className="text-sm"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("discover.applyFilters")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const NICHE_OPTIONS = [
  { key: "beauty", label: "Beauty" },
  { key: "fashion", label: "Fashion" },
  { key: "food", label: "Food & Drink" },
  { key: "travel", label: "Travel" },
  { key: "tech", label: "Tech" },
  { key: "fitness", label: "Fitness" },
  { key: "gaming", label: "Gaming" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "education", label: "Education" },
  { key: "entertainment", label: "Entertainment" },
  { key: "parenting", label: "Parenting" },
  { key: "health", label: "Health" },
  { key: "finance", label: "Finance" },
];

export default function DiscoverScreen() {
  const { session, profile, profileReady } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("forYou");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<{
    forYou: DiscoverCampaignCard[];
    browseAll: DiscoverCampaignCard[];
  }>({
    forYou: [],
    browseAll: [],
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const homeState = decideCreatorHomeState(profile?.status ?? null);

  const fetchData = useCallback(async () => {
    if (
      homeState !== "workspace" ||
      !profileReady ||
      !session?.user?.id
    ) {
      return;
    }

    try {
      const workspace = await loadCreatorWorkspace(session.user.id);
      setCampaigns(workspace.discover);
    } catch {
      setHasError(true);
    }
  }, [homeState, profileReady, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setHasError(false);
      await fetchData();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  function tabLabel(tab: Tab): string {
    return tab === "forYou" ? t("discover.forYou") : t("discover.browseAll");
  }

  const activeFilterCount = countActiveFilters(filters);

  const processedFeed = useMemo(() => {
    const raw =
      activeTab === "forYou" ? campaigns.forYou : campaigns.browseAll;
    let feed = filterDiscoverFeed(raw, search);
    feed = applyDiscoverFilters(feed, filters);
    feed = sortDiscoverFeed(feed, activeTab === "forYou" ? sortMode : sortMode === "recommended" ? "deadline" : sortMode);
    return feed;
  }, [campaigns, activeTab, search, filters, sortMode]);

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      <View className="px-6 pt-6 pb-1">
        <Text
          className="text-[28px] tracking-tight"
          style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
        >
          {t("discover.title")}
        </Text>

        {/* Search bar */}
        <View
          className="mt-5 flex-row items-center rounded-xl px-4 py-3.5"
          style={{
            backgroundColor: palette.surface,
            borderWidth: 1,
            borderColor: palette.borderSubtle,
          }}
        >
          <Search size={18} color={palette.textTertiary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("discover.search")}
            placeholderTextColor={palette.inputPlaceholder}
            className="ms-3 flex-1 text-base"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_400Regular",
            }}
          />
        </View>

        {/* Tab pills + sort + filter */}
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row gap-2">
            {(["forYou", "browseAll"] as Tab[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 ${activeTab === tab ? "" : "border"}`}
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
                  className="text-[13px]"
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

          <View className="flex-row items-center gap-2">
            {/* Sort dropdown */}
            <SortPicker
              value={sortMode}
              onChange={setSortMode}
              palette={palette}
              t={t}
            />

            {/* Filter button */}
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
              style={{
                backgroundColor:
                  activeFilterCount > 0
                    ? palette.buttonPrimaryBackground
                    : palette.surface,
                borderColor:
                  activeFilterCount > 0
                    ? palette.buttonPrimaryBackground
                    : palette.inputBorder,
              }}
            >
              <SlidersHorizontal
                size={14}
                color={
                  activeFilterCount > 0
                    ? palette.buttonPrimaryText
                    : palette.textSecondary
                }
                strokeWidth={1.8}
              />
              {activeFilterCount > 0 ? (
                <Text
                  className="text-xs"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {activeFilterCount}
                </Text>
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Campaign list */}
      {homeState !== "workspace" ? (
        <View className="flex-1 px-6">
          <ProfileSetupCard onPress={() => router.push("/(tabs)/profile")} />
        </View>
      ) : (
        <FlatList
          data={processedFeed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CampaignCard
              item={item}
              palette={palette}
              t={t}
              locale={locale}
              showMatchReasons={activeTab === "forYou"}
              isSaved={savedIds.has(item.id)}
              onToggleSave={() => toggleSaved(item.id)}
            />
          )}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            loading ? (
              <View className="pt-4 pb-10">
                {[0, 1, 2].map((index) => (
                  <View
                    key={index}
                    className="mb-3 rounded-2xl border px-5 py-5"
                    style={{
                      backgroundColor: palette.surfaceMuted,
                      borderColor: palette.borderSubtle,
                    }}
                  >
                    <View
                      className="h-3 w-20 rounded-full"
                      style={{ backgroundColor: palette.skeleton }}
                    />
                    <View
                      className="mt-2.5 h-4 w-44 rounded-full"
                      style={{ backgroundColor: palette.skeleton }}
                    />
                    <View
                      className="mt-3 flex-row gap-2"
                    >
                      <View
                        className="h-6 w-16 rounded-full"
                        style={{ backgroundColor: palette.surfaceStrong }}
                      />
                      <View
                        className="h-6 w-20 rounded-full"
                        style={{ backgroundColor: palette.surfaceStrong }}
                      />
                    </View>
                    <View
                      className="mt-3 h-4 w-28 rounded-full"
                      style={{ backgroundColor: palette.skeleton }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center pt-28 pb-20">
                <View
                  className="mb-6 h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle }}
                >
                  <Search size={24} color={palette.textMuted} strokeWidth={1.5} />
                </View>
                <Text
                  className="text-base"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {hasError ? t("error.generic") : t("discover.empty")}
                </Text>
                <Text
                  className="mt-2 max-w-[260px] text-center text-sm"
                  style={{
                    color: palette.textSecondary,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {hasError ? t("error.network") : t("discover.emptyDetail")}
                </Text>
                {activeFilterCount > 0 ? (
                  <Pressable
                    onPress={() => setFilters(EMPTY_FILTERS)}
                    className="mt-4 rounded-full border px-5 py-2.5"
                    style={{ borderColor: palette.inputBorder }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: palette.textSecondary,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {t("discover.clearFilters")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}

      <FilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onApply={setFilters}
        palette={palette}
        t={t}
      />
    </SafeAreaView>
  );
}
