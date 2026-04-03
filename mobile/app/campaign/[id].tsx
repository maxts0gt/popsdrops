import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Sparkles,
} from "lucide-react-native";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

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
  }>();

  const platforms = params.platforms ? params.platforms.split(",") : [];
  const niches = params.niches ? params.niches.split(",") : [];
  const markets = params.markets ? params.markets.split(",") : [];
  const budgetMin = params.budgetMin ? Number(params.budgetMin) : null;
  const budgetMax = params.budgetMax ? Number(params.budgetMax) : null;
  const matchScore = params.matchScore ? Number(params.matchScore) : 0;
  const hasApplied = !!params.applicationStatus;

  const budgetLabel = formatBudget(budgetMin, budgetMax, params.budgetCurrency ?? "USD", locale);

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
          style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
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
            style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
          >
            {params.brandName}
          </Text>
          <Text
            className="mt-2 text-[26px] leading-[32px] tracking-tight"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {params.title}
          </Text>

          {/* Recommended badge */}
          {matchScore >= 60 ? (
            <View className="mt-4 flex-row items-center gap-1.5">
              <View
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                style={{ backgroundColor: palette.atmosphereTeal }}
              >
                <Sparkles size={12} color={palette.textTertiary} strokeWidth={2} />
                <Text
                  className="text-xs"
                  style={{ color: palette.textTertiary, fontFamily: "Inter_600SemiBold" }}
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
            {/* Budget */}
            <View
              className="flex-1 rounded-2xl px-4 py-4"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <DollarSign size={16} color={palette.textMuted} strokeWidth={1.6} />
              <Text
                className="mt-3 text-[17px]"
                style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
              >
                {budgetLabel}
              </Text>
              <Text
                className="mt-1 text-[11px] uppercase tracking-[1.2px]"
                style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
              >
                {t("campaignDetail.budget")}
              </Text>
            </View>

            {/* Deadline */}
            <View
              className="flex-1 rounded-2xl px-4 py-4"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <Calendar size={16} color={palette.textMuted} strokeWidth={1.6} />
              <Text
                className="mt-3 text-[17px]"
                style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
              >
                {daysLeft !== null ? `${daysLeft}d` : "—"}
              </Text>
              <Text
                className="mt-1 text-[11px] uppercase tracking-[1.2px]"
                style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
              >
                {t("campaignDetail.deadline")}
              </Text>
            </View>
          </View>
        </View>

        {/* Platforms */}
        {platforms.length > 0 ? (
          <View className="mt-6 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.4px]"
              style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
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
                    style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
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
              style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
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
                    style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
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
              style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
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
                  <Globe size={13} color={palette.textTertiary} strokeWidth={1.6} />
                  <Text
                    className="text-sm"
                    style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
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
                style={{ color: palette.textPrimary, fontFamily: "Inter_500Medium" }}
              >
                {deadlineLabel}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
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
        <Pressable
          className="items-center rounded-xl py-4"
          style={{
            backgroundColor: hasApplied
              ? palette.surfaceStrong
              : palette.buttonPrimaryBackground,
          }}
          disabled={hasApplied}
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
      </View>
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
