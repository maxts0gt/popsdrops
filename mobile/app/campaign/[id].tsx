import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Sparkles,
  X,
  Send,
} from "lucide-react-native";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import {
  applyToCampaign,
  respondToCounterOffer,
} from "../../lib/campaign-actions";

const PLATFORM_DISPLAY: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  youtube: "YouTube",
  facebook: "Facebook",
};

export default function CampaignDetailScreen() {
  const { palette } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    brandName: string;
    platforms: string;
    budgetMin: string;
    budgetMax: string;
    budgetCurrency: string;
    applicationDeadline: string;
    matchScore: string;
    applicationStatus: string;
    niches: string;
    markets: string;
    proposedRate: string;
    counterRate: string;
    applicationId: string;
  }>();

  const platforms = params.platforms ? params.platforms.split(",") : [];
  const niches = params.niches ? params.niches.split(",") : [];
  const markets = params.markets ? params.markets.split(",") : [];
  const budgetMin = params.budgetMin ? Number(params.budgetMin) : null;
  const budgetMax = params.budgetMax ? Number(params.budgetMax) : null;
  const matchScore = params.matchScore ? Number(params.matchScore) : 0;

  const [applicationStatus, setApplicationStatus] = useState(
    params.applicationStatus || null,
  );
  const [applicationId, setApplicationId] = useState(
    params.applicationId || null,
  );
  const [proposedRate, setProposedRate] = useState(
    params.proposedRate ? Number(params.proposedRate) : null,
  );
  const [counterRate, setCounterRate] = useState(
    params.counterRate ? Number(params.counterRate) : null,
  );

  // Apply modal state
  const [showApplySheet, setShowApplySheet] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [pitchInput, setPitchInput] = useState("");
  const [applying, setApplying] = useState(false);

  // Counter-offer response state
  const [responding, setResponding] = useState(false);

  // Fetch latest application status on mount
  useEffect(() => {
    if (!user?.id || !params.id) return;
    let cancelled = false;

    void (async () => {
      const { data } = await supabase
        .from("campaign_applications")
        .select("id, status, proposed_rate, counter_rate")
        .eq("campaign_id", params.id)
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled && data) {
        setApplicationStatus(data.status);
        setApplicationId(data.id);
        setProposedRate(data.proposed_rate);
        setCounterRate(data.counter_rate);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, params.id]);

  // Pre-fill rate from creator's rate card
  useEffect(() => {
    if (!user?.id || rateInput) return;
    void (async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("rate_card")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (data?.rate_card && typeof data.rate_card === "object") {
        // Find first rate from rate card
        const card = data.rate_card as Record<string, Record<string, number>>;
        for (const platformRates of Object.values(card)) {
          for (const rate of Object.values(platformRates)) {
            if (rate > 0) {
              setRateInput(String(rate));
              return;
            }
          }
        }
      }
    })();
  }, [user?.id]);

  const hasApplied = !!applicationStatus;
  const isCounterOffer = applicationStatus === "counter_offer";

  const budgetLabel = formatBudget(
    budgetMin,
    budgetMax,
    params.budgetCurrency ?? "USD",
    locale,
  );

  const [now] = useState(() => Date.now());
  const daysLeft = params.applicationDeadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(params.applicationDeadline).getTime() - now) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const deadlineLabel = params.applicationDeadline
    ? new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(params.applicationDeadline))
    : null;

  const handleApply = useCallback(async () => {
    const rate = Number(rateInput);
    if (!rate || rate < 1) {
      Alert.alert(t("error.generic"), t("apply.rateRequired"));
      return;
    }
    if (pitchInput.trim().length < 10) {
      Alert.alert(t("error.generic"), t("apply.pitchRequired"));
      return;
    }

    setApplying(true);
    try {
      const result = await applyToCampaign({
        campaign_id: params.id!,
        proposed_rate: rate,
        pitch: pitchInput.trim(),
      });
      setApplicationStatus("pending");
      setApplicationId(result.id);
      setProposedRate(rate);
      setShowApplySheet(false);
      setRateInput("");
      setPitchInput("");
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setApplying(false);
    }
  }, [rateInput, pitchInput, params.id, t]);

  const handleCounterResponse = useCallback(
    async (accept: boolean) => {
      if (!applicationId) return;
      setResponding(true);
      try {
        await respondToCounterOffer(applicationId, accept);
        setApplicationStatus(accept ? "accepted" : "rejected");
      } catch (err) {
        Alert.alert(t("error.generic"), (err as Error).message);
      } finally {
        setResponding(false);
      }
    },
    [applicationId, t],
  );

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top", "bottom"]}
      style={{ backgroundColor: palette.background }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-4 px-6 pt-4 pb-2">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={palette.textPrimary} strokeWidth={1.8} />
        </Pressable>
        <Text
          className="flex-1 text-base"
          style={{
            color: palette.textPrimary,
            fontFamily: "Inter_600SemiBold",
          }}
          numberOfLines={1}
        >
          {t("campaignDetail.title")}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero section */}
        <View className="px-6 pt-6">
          <Text
            className="text-xs uppercase tracking-[1.4px]"
            style={{
              color: palette.textTertiary,
              fontFamily: "Inter_500Medium",
            }}
          >
            {params.brandName}
          </Text>
          <Text
            className="mt-2 text-[26px] leading-[32px] tracking-tight"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {params.title}
          </Text>

          {matchScore >= 60 ? (
            <View className="mt-4 flex-row items-center gap-1.5">
              <View
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: palette.atmosphereTeal }}
              >
                <Sparkles
                  size={12}
                  color={palette.textTertiary}
                  strokeWidth={2}
                />
                <Text
                  className="text-xs"
                  style={{
                    color: palette.textTertiary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("discover.recommended")}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Key details cards */}
        <View className="mt-8 px-6">
          <View className="flex-row gap-3">
            <View
              className="flex-1 rounded-2xl px-4 py-4"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <DollarSign
                size={16}
                color={palette.textMuted}
                strokeWidth={1.6}
              />
              <Text
                className="mt-3 text-[17px]"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {budgetLabel}
              </Text>
              <Text
                className="mt-1 text-[11px] uppercase tracking-[1.2px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {t("campaignDetail.budget")}
              </Text>
            </View>

            <View
              className="flex-1 rounded-2xl px-4 py-4"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <Calendar
                size={16}
                color={palette.textMuted}
                strokeWidth={1.6}
              />
              <Text
                className="mt-3 text-[17px]"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {daysLeft !== null ? `${daysLeft}d` : "—"}
              </Text>
              <Text
                className="mt-1 text-[11px] uppercase tracking-[1.2px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {t("campaignDetail.deadline")}
              </Text>
            </View>
          </View>
        </View>

        {/* Counter-offer card */}
        {isCounterOffer && counterRate != null ? (
          <View
            className="mx-6 mt-6 rounded-2xl px-5 py-5"
            style={{
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <Text
              className="text-xs uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("campaignDetail.counterOffer")}
            </Text>

            <View className="mt-4 flex-row items-center gap-4">
              <View className="flex-1">
                <Text
                  className="text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {t("campaignDetail.yourRate")}
                </Text>
                <Text
                  className="mt-1 text-lg"
                  style={{
                    color: palette.textSecondary,
                    fontFamily: "Inter_600SemiBold",
                    textDecorationLine: "line-through",
                  }}
                >
                  ${proposedRate?.toLocaleString()}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className="text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {t("campaignDetail.brandOffer")}
                </Text>
                <Text
                  className="mt-1 text-lg"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  ${counterRate.toLocaleString()}
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => handleCounterResponse(false)}
                disabled={responding}
                className="flex-1 items-center rounded-xl border py-3.5"
                style={{ borderColor: palette.inputBorder }}
              >
                <Text
                  className="text-sm"
                  style={{
                    color: palette.textSecondary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("campaignDetail.decline")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleCounterResponse(true)}
                disabled={responding}
                className="flex-1 items-center rounded-xl py-3.5"
                style={{
                  backgroundColor: palette.buttonPrimaryBackground,
                }}
              >
                {responding ? (
                  <ActivityIndicator
                    size="small"
                    color={palette.buttonPrimaryText}
                  />
                ) : (
                  <Text
                    className="text-sm"
                    style={{
                      color: palette.buttonPrimaryText,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  >
                    {t("campaignDetail.accept")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Platforms */}
        {platforms.length > 0 ? (
          <View className="mt-6 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("campaignDetail.platforms")}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {platforms.map((platform) => (
                <View
                  key={platform}
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: palette.accentSoft }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: palette.textTertiary,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {PLATFORM_DISPLAY[platform] ?? platform}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Niches */}
        {niches.length > 0 ? (
          <View className="mt-6 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("campaignDetail.niches")}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {niches.map((niche) => (
                <View
                  key={niche}
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: palette.surfaceMuted }}
                >
                  <Text
                    className="text-sm"
                    style={{
                      color: palette.textSecondary,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {t(`niche.${niche}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Markets */}
        {markets.length > 0 ? (
          <View className="mt-6 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("campaignDetail.markets")}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {markets.map((market) => (
                <View
                  key={market}
                  className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
                  style={{ backgroundColor: palette.surfaceMuted }}
                >
                  <Globe
                    size={13}
                    color={palette.textTertiary}
                    strokeWidth={1.6}
                  />
                  <Text
                    className="text-sm"
                    style={{
                      color: palette.textSecondary,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {market}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Deadline detail */}
        {deadlineLabel ? (
          <View
            className="mx-6 mt-8 flex-row items-center gap-3 rounded-2xl px-5 py-4"
            style={{
              backgroundColor: palette.surface,
              borderWidth: 1,
              borderColor: palette.borderSubtle,
            }}
          >
            <Clock size={16} color={palette.textMuted} strokeWidth={1.6} />
            <View className="flex-1">
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {deadlineLabel}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {daysLeft !== null && daysLeft > 0
                  ? t("campaignDetail.spotsOpen")
                  : t("campaignDetail.deadlinePassed")}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View
        className="border-t px-6 pb-4 pt-4"
        style={{
          borderColor: palette.borderSubtle,
          backgroundColor: palette.background,
        }}
      >
        {isCounterOffer ? null : (
          <Pressable
            className="items-center rounded-xl py-4"
            style={{
              backgroundColor: hasApplied
                ? palette.surfaceStrong
                : palette.buttonPrimaryBackground,
            }}
            disabled={hasApplied}
            onPress={() => setShowApplySheet(true)}
          >
            <Text
              className="text-sm"
              style={{
                color: hasApplied
                  ? palette.textMuted
                  : palette.buttonPrimaryText,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {hasApplied
                ? t("campaignDetail.applied")
                : t("campaignDetail.apply")}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Apply Bottom Sheet Modal */}
      <Modal
        visible={showApplySheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowApplySheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          style={{ backgroundColor: palette.background }}
        >
          <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
            {/* Modal header */}
            <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
              <Text
                className="text-lg"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {t("apply.title")}
              </Text>
              <Pressable
                onPress={() => setShowApplySheet(false)}
                hitSlop={12}
              >
                <X size={22} color={palette.textMuted} strokeWidth={1.8} />
              </Pressable>
            </View>

            <ScrollView
              className="flex-1 px-6"
              keyboardShouldPersistTaps="handled"
            >
              {/* Campaign name */}
              <Text
                className="mt-4 text-sm"
                style={{
                  color: palette.textSecondary,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {params.title}
              </Text>

              {/* Rate input */}
              <Text
                className="mt-8 text-xs uppercase tracking-[1.4px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("apply.rateLabel")}
              </Text>
              <View
                className="mt-3 flex-row items-center rounded-xl border px-4"
                style={{
                  borderColor: palette.inputBorder,
                  backgroundColor: palette.surface,
                }}
              >
                <Text
                  className="text-lg"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  $
                </Text>
                <TextInput
                  value={rateInput}
                  onChangeText={setRateInput}
                  placeholder="0"
                  placeholderTextColor={palette.textMuted}
                  keyboardType="numeric"
                  className="flex-1 py-4 text-lg"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_600SemiBold",
                    marginStart: 4,
                  }}
                />
              </View>
              {budgetLabel !== "—" ? (
                <Text
                  className="mt-2 text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {t("apply.budgetHint", { budget: budgetLabel })}
                </Text>
              ) : null}

              {/* Pitch input */}
              <Text
                className="mt-8 text-xs uppercase tracking-[1.4px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("apply.pitchLabel")}
              </Text>
              <TextInput
                value={pitchInput}
                onChangeText={(text) =>
                  setPitchInput(text.slice(0, 500))
                }
                placeholder={t("apply.pitchPlaceholder")}
                placeholderTextColor={palette.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="mt-3 rounded-xl border px-4 py-3.5"
                style={{
                  borderColor: palette.inputBorder,
                  backgroundColor: palette.surface,
                  color: palette.textPrimary,
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  minHeight: 120,
                }}
              />
              <Text
                className="mt-2 text-right text-xs"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {pitchInput.length}/500
              </Text>
            </ScrollView>

            {/* Submit button */}
            <View className="px-6 pb-4 pt-2">
              <Pressable
                onPress={handleApply}
                disabled={applying}
                className="items-center rounded-xl py-4"
                style={{
                  backgroundColor: palette.buttonPrimaryBackground,
                  opacity: applying ? 0.7 : 1,
                }}
              >
                {applying ? (
                  <ActivityIndicator
                    size="small"
                    color={palette.buttonPrimaryText}
                  />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Send
                      size={16}
                      color={palette.buttonPrimaryText}
                      strokeWidth={2}
                    />
                    <Text
                      className="text-sm"
                      style={{
                        color: palette.buttonPrimaryText,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {t("apply.submit")}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function formatBudget(
  min: number | null,
  max: number | null,
  currency: string,
  locale: string,
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  if (min != null && max != null) {
    return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
  }

  if (min != null) return `${fmt(min)}+`;
  if (max != null) return `Up to ${fmt(max)}`;
  return "—";
}
