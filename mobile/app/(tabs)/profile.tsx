import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Layers,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Star,
} from "lucide-react-native";
import {
  LANGUAGE_LABELS,
  MARKET_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
  type Platform,
} from "../../../shared/types";
import { useAuth } from "../../lib/auth";
import {
  loadCreatorProfileData,
  type LoadedCreatorProfile,
} from "../../lib/creator-profile-data";
import { buildCreatorProfileViewModel } from "../../lib/creator-profile";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }

  return String(count);
}

function formatResponseHours(hours: number | null): string {
  if (hours == null) {
    return "—";
  }

  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }

  return `${Math.round(hours / 24)}d`;
}

function getInitials(value: string): string {
  const initials = value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "PD";
}

function formatRateLabel(
  rate: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(rate);
}

function labelizeFormatKey(value: string): string {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getTierLabel(
  tier: LoadedCreatorProfile["creator"]["tier"],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (tier) {
    case "rising":
      return t("profile.tierRising");
    case "established":
      return t("profile.tierEstablished");
    case "top":
      return t("profile.tierTop");
    default:
      return t("profile.tierNew");
  }
}

type CompletenessStep = {
  key: string;
  label: string;
  done: boolean;
  actionable: boolean;
};

function buildCompletenessSteps(
  creator: LoadedCreatorProfile["creator"],
  t: (key: string) => string,
): CompletenessStep[] {
  const socials = [
    creator.socialAccounts.tiktok,
    creator.socialAccounts.instagram,
    creator.socialAccounts.snapchat,
    creator.socialAccounts.youtube,
    creator.socialAccounts.facebook,
  ];
  const connectedCount = socials.filter(Boolean).length;

  return [
    { key: "bio", label: t("profile.stepBio"), done: !!creator.bio, actionable: true },
    { key: "social", label: t("profile.stepSocial"), done: connectedCount >= 1, actionable: false },
    { key: "social2", label: t("profile.stepSocial2"), done: connectedCount >= 2, actionable: false },
    { key: "niches", label: t("profile.stepNiches"), done: creator.niches.length > 0, actionable: false },
    { key: "rateCard", label: t("profile.stepRateCard"), done: !!creator.rateCard && Object.keys(creator.rateCard).length > 0, actionable: false },
    { key: "markets", label: t("profile.stepMarkets"), done: creator.markets.length > 0, actionable: false },
    { key: "languages", label: t("profile.stepLanguages"), done: creator.languages.length > 0, actionable: true },
    { key: "primaryMarket", label: t("profile.stepPrimaryMarket"), done: !!creator.primaryMarket, actionable: true },
  ];
}

function CompletenessCard({
  creator,
  viewModel,
  palette,
  t,
  onEditBasics,
}: {
  creator: LoadedCreatorProfile["creator"];
  viewModel: ReturnType<typeof buildCreatorProfileViewModel>;
  palette: ReturnType<typeof useTheme>["palette"];
  t: (key: string) => string;
  onEditBasics: () => void;
}) {
  const steps = buildCompletenessSteps(creator, t);
  const isComplete = viewModel.completenessPercent >= 100;
  return (
    <View
      className="mx-6 rounded-2xl border px-5 py-5"
      style={{
        backgroundColor: palette.surfaceMuted,
        borderColor: palette.borderSubtle,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="text-sm uppercase tracking-[1.6px]"
          style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
        >
          {t("profile.completeness")}
        </Text>
        <Text
          className="text-sm"
          style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
        >
          {viewModel.completenessPercent}%
        </Text>
      </View>
      <View
        className="mt-4 h-2 rounded-full"
        style={{ backgroundColor: palette.surfaceStrong }}
      >
        <View
          className="h-2 rounded-full"
          style={{
            width: `${viewModel.completenessPercent}%`,
            backgroundColor: palette.buttonPrimaryBackground,
          }}
        />
      </View>

      {/* Completeness checklist */}
      {!isComplete ? (
        <View className="mt-5">
          <Text
            className="text-xs"
            style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
          >
            {t("profile.completenessGuide")}
          </Text>
          <View className="mt-3 gap-2.5">
            {steps.map((step) => (
              <Pressable
                key={step.key}
                onPress={step.actionable && !step.done ? onEditBasics : undefined}
                disabled={step.done || !step.actionable}
                className="flex-row items-center gap-3"
              >
                {step.done ? (
                  <Check size={15} color={palette.buttonPrimaryBackground} strokeWidth={2.5} />
                ) : (
                  <Circle size={15} color={palette.textMuted} strokeWidth={1.5} />
                )}
                <Text
                  className="flex-1 text-sm"
                  style={{
                    color: step.done ? palette.textMuted : palette.textPrimary,
                    fontFamily: step.done ? "Inter_400Regular" : "Inter_500Medium",
                    textDecorationLine: step.done ? "line-through" : "none",
                  }}
                >
                  {step.label}
                </Text>
                {!step.done && step.actionable ? (
                  <ChevronRight size={14} color={palette.textTertiary} strokeWidth={1.8} />
                ) : !step.done ? (
                  <Text
                    className="text-[10px]"
                    style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
                  >
                    {t("profile.manageOnWeb")}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View className="mt-4 flex-row items-center gap-2">
          <Check size={15} color={palette.buttonPrimaryBackground} strokeWidth={2.5} />
          <Text
            className="text-sm"
            style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
          >
            {t("profile.stepComplete")}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profileReady, signOut } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<LoadedCreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const mutedCardStyle = {
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.borderSubtle,
  };
  const surfaceCardStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.borderSubtle,
  };
  const chipStyle = {
    backgroundColor: palette.accentSoft,
  };

  useFocusEffect(
    useCallback(() => {
      if (!profileReady || !session?.user?.id) {
        return undefined;
      }

      let cancelled = false;

      void (async () => {
        setLoading(true);
        setHasError(false);

        try {
          const nextData = await loadCreatorProfileData(session.user.id);
          if (!cancelled) {
            setData(nextData);
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
    }, [profileReady, session?.user?.id]),
  );

  if (loading || !data) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["top"]}
        style={{ backgroundColor: palette.background }}
      >
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          <View className="items-center px-6 pt-8 pb-6">
            <View
              className="h-20 w-20 rounded-full"
              style={{ backgroundColor: palette.skeleton }}
            />
            <View
              className="mt-4 h-6 w-40 rounded-full"
              style={{ backgroundColor: palette.skeleton }}
            />
            <View
              className="mt-3 h-4 w-28 rounded-full"
              style={{ backgroundColor: palette.surfaceStrong }}
            />
          </View>
          <View className="mx-6 rounded-2xl p-4" style={{ backgroundColor: palette.surfaceMuted }}>
            <View
              className="h-4 w-28 rounded-full"
              style={{ backgroundColor: palette.skeleton }}
            />
            <View
              className="mt-4 h-2 rounded-full"
              style={{ backgroundColor: palette.skeleton }}
            />
          </View>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              className="mx-6 mt-6 rounded-2xl border px-5 py-5"
              style={mutedCardStyle}
            >
              <View
                className="h-4 w-24 rounded-full"
                style={{ backgroundColor: palette.skeleton }}
              />
              <View
                className="mt-4 h-12 rounded-2xl"
                style={{ backgroundColor: palette.surfaceStrong }}
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView
        className="flex-1"
        edges={["top"]}
        style={{ backgroundColor: palette.background }}
      >
        <View className="flex-1 justify-center px-6">
          <View
            className="rounded-2xl border px-5 py-5"
            style={{
              backgroundColor: palette.errorSurface,
              borderColor: palette.errorBorder,
            }}
          >
            <Text
              className="text-base"
              style={{ color: palette.errorText, fontFamily: "Inter_600SemiBold" }}
            >
              {t("error.generic")}
            </Text>
            <Text
              className="mt-2 text-sm"
              style={{ color: palette.errorText, fontFamily: "Inter_400Regular" }}
            >
              {t("error.network")}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const { profile, creator, viewModel } = data;
  const rateEntries = creator.rateCard
    ? Object.entries(creator.rateCard).flatMap(([platform, formats]) =>
        Object.entries(formats).map(([format, rate]) => ({
          key: `${platform}:${format}`,
          platform: PLATFORM_LABELS[platform as Platform] ?? platform,
          format: labelizeFormatKey(format),
          rate,
        })),
      )
    : [];

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="items-center px-6 pt-10 pb-8">
          {profile.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              alt={viewModel.displayName}
              className="h-24 w-24 rounded-full"
            />
          ) : (
            <View
              className="h-24 w-24 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <Text
                className="text-2xl"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {getInitials(viewModel.displayName)}
              </Text>
            </View>
          )}

          <Text
            className="mt-5 text-[22px] tracking-tight"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {viewModel.displayName}
          </Text>

          <View className="mt-2.5 rounded-full px-4 py-1.5" style={chipStyle}>
            <Text
              className="text-xs"
              style={{ color: palette.textTertiary, fontFamily: "Inter_500Medium" }}
            >
              {getTierLabel(creator.tier, t)}
            </Text>
          </View>

          <Text
            className="mt-3 text-sm"
            style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
          >
            {profile.email}
          </Text>
        </View>

        <CompletenessCard
          creator={creator}
          viewModel={viewModel}
          palette={palette}
          t={t}
          onEditBasics={() => router.push("../edit-profile")}
        />

        <View
          className="mx-6 mt-4 flex-row rounded-2xl p-5"
          style={{ backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle }}
        >
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Star size={14} color={palette.textPrimary} />
              <Text
                className="text-lg"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {creator.rating > 0 ? creator.rating.toFixed(1) : "—"}
              </Text>
            </View>
            <Text
              className="mt-1 text-xs"
              style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
            >
              {t("profile.rating")}
            </Text>
          </View>
          <View className="w-px" style={{ backgroundColor: palette.borderSubtle }} />
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Layers size={14} color={palette.textPrimary} />
              <Text
                className="text-lg"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {creator.campaignsCompleted}
              </Text>
            </View>
            <Text
              className="mt-1 text-xs"
              style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
            >
              {t("profile.campaigns")}
            </Text>
          </View>
          <View className="w-px" style={{ backgroundColor: palette.borderSubtle }} />
          <View className="flex-1 items-center">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color={palette.textPrimary} />
              <Text
                className="text-lg"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {formatResponseHours(creator.avgResponseTimeHours)}
              </Text>
            </View>
            <Text
              className="mt-1 text-xs"
              style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
            >
              {t("profile.response")}
            </Text>
          </View>
        </View>

        <View className="mx-6 mt-8 rounded-2xl border px-5 py-5" style={surfaceCardStyle}>
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm uppercase tracking-[1.6px]"
              style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
            >
              {t("profile.bio")}
            </Text>
            <Pressable onPress={() => router.push("../edit-profile")}>
              <Text
                className="text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
              >
                {t("action.edit")}
              </Text>
            </Pressable>
          </View>
          <Text
            className="mt-4 text-sm leading-6"
            style={{ color: palette.textTertiary, fontFamily: "Inter_400Regular" }}
          >
            {creator.bio || t("profile.emptyBio")}
          </Text>
        </View>

        <View className="mx-6 mt-8 rounded-2xl border px-5 py-5" style={surfaceCardStyle}>
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm uppercase tracking-[1.6px]"
              style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
            >
              {t("profile.editBasicsTitle")}
            </Text>
            <Pressable onPress={() => router.push("../edit-profile")}>
              <Text
                className="text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
              >
                {t("action.edit")}
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 gap-4">
            <View>
              <Text
                className="text-xs uppercase tracking-[1.4px]"
                style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
              >
                {t("profile.primaryMarket")}
              </Text>
              <Text
                className="mt-1 text-sm"
                style={{ color: palette.textPrimary, fontFamily: "Inter_500Medium" }}
              >
                {creator.primaryMarket
                  ? MARKET_LABELS[creator.primaryMarket as keyof typeof MARKET_LABELS]
                  : t("profile.noMarket")}
              </Text>
            </View>

            <View>
              <Text
                className="text-xs uppercase tracking-[1.4px]"
                style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
              >
                {t("profile.languages")}
              </Text>
              <Text
                className="mt-1 text-sm"
                style={{ color: palette.textPrimary, fontFamily: "Inter_500Medium" }}
              >
                {creator.languages.length
                  ? creator.languages
                      .map(
                        (language) =>
                          LANGUAGE_LABELS[
                            language as keyof typeof LANGUAGE_LABELS
                          ] ?? language,
                      )
                      .join(" · ")
                  : t("profile.noLanguages")}
              </Text>
            </View>
          </View>
        </View>

        <View className="mx-6 mt-8">
          <Text
            className="text-sm uppercase tracking-[1.6px]"
            style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
          >
            {t("profile.socialAccounts")}
          </Text>
          <View className="mt-3 gap-2">
            {PLATFORMS.map((platform) => {
              const account = creator.socialAccounts[platform];
              return (
                <View
                  key={platform}
                  className="flex-row items-center justify-between rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: palette.surfaceMuted }}
                >
                  <View>
                    <Text
                      className="text-sm"
                      style={{ color: palette.textPrimary, fontFamily: "Inter_500Medium" }}
                    >
                      {PLATFORM_LABELS[platform]}
                    </Text>
                    <Text
                      className="mt-1 text-xs"
                      style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
                    >
                      {account
                        ? `${account.handle} · ${formatFollowers(account.followers)}`
                        : t("profile.notConnected")}
                    </Text>
                  </View>
                  <Text
                    className="text-xs"
                    style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
                  >
                    {account ? t("profile.connected") : t("profile.manageOnWeb")}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View className="mx-6 mt-8">
          <Text
            className="text-sm uppercase tracking-[1.6px]"
            style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
          >
            {t("profile.niches")}
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {viewModel.niches.length ? (
              viewModel.niches.map((niche) => (
                <View
                  key={niche}
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: palette.surfaceMuted }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: palette.textTertiary, fontFamily: "Inter_400Regular" }}
                  >
                    {t(`niche.${niche}`)}
                  </Text>
                </View>
              ))
            ) : (
              <Text
                className="text-sm"
                style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
              >
                {t("profile.noNiches")}
              </Text>
            )}
          </View>
        </View>

        <View className="mx-6 mt-8">
          <Text
            className="text-sm uppercase tracking-[1.6px]"
            style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
          >
            {t("profile.rateCard")}
          </Text>
          {rateEntries.length ? (
            <View className="mt-3 gap-2">
              {rateEntries.slice(0, 4).map((entry) => (
                <View
                  key={entry.key}
                  className="flex-row items-center justify-between rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: palette.surfaceMuted }}
                >
                  <View>
                    <Text
                      className="text-sm"
                      style={{ color: palette.textPrimary, fontFamily: "Inter_500Medium" }}
                    >
                      {entry.platform}
                    </Text>
                    <Text
                      className="mt-1 text-xs"
                      style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
                    >
                      {entry.format}
                    </Text>
                  </View>
                  <Text
                    className="text-sm"
                    style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
                  >
                    {formatRateLabel(entry.rate, creator.rateCurrency, locale)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View
              className="mt-3 rounded-xl px-4 py-4"
              style={{ backgroundColor: palette.surfaceMuted }}
            >
              <Text
                className="text-sm"
                style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
              >
                {t("profile.noRates")}
              </Text>
            </View>
          )}
        </View>

        <View className="mx-6 mt-10">
          <Pressable
            onPress={() => router.push("../edit-profile")}
            className="flex-row items-center justify-center rounded-xl px-6 py-3.5"
            style={{ backgroundColor: palette.buttonPrimaryBackground }}
          >
            <Text
              className="text-sm"
              style={{
                color: palette.buttonPrimaryText,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("profile.editProfile")}
            </Text>
            <ChevronRight size={16} color={palette.buttonPrimaryText} className="ms-2" />
          </Pressable>
        </View>

        <View className="mx-6 mt-4">
          <Pressable
            onPress={() => router.push("../preferences")}
            className="flex-row items-center justify-between rounded-2xl border px-5 py-4"
            style={{ backgroundColor: palette.surface, borderColor: palette.borderSubtle }}
          >
            <View className="flex-1 pe-4">
              <Text
                className="text-sm"
                style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
              >
                {t("profile.preferences")}
              </Text>
              <Text
                className="mt-1 text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
              >
                {t("profile.preferencesDetail")}
              </Text>
            </View>
            <ChevronRight size={18} color={palette.textTertiary} />
          </Pressable>
        </View>

        <Pressable
          onPress={signOut}
          className="mx-6 mb-10 mt-4 items-center py-3"
        >
          <Text
            className="text-sm"
            style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
          >
            {t("action.signOut")}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
