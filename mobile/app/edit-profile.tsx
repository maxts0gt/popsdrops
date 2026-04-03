import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  MARKETS,
  MARKET_LABELS,
} from "../../shared/types";
import { useAuth } from "../lib/auth";
import {
  loadCreatorProfileData,
  type LoadedCreatorProfile,
  updateCreatorProfileBasicsMobile,
} from "../lib/creator-profile-data";
import {
  normalizeCreatorProfileBasics,
  validateCreatorProfileBasics,
} from "../lib/creator-profile";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

type BasicsForm = {
  full_name: string;
  bio: string;
  primary_market: string;
  languages: string[];
};

export default function EditProfileBasicsScreen() {
  const { session, profileReady, refreshProfile } = useAuth();
  const { t } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<LoadedCreatorProfile | null>(null);
  const [form, setForm] = useState<BasicsForm>({
    full_name: "",
    bio: "",
    primary_market: "",
    languages: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPillStyle = {
    backgroundColor: palette.buttonPrimaryBackground,
  };
  const unselectedPillStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.inputBorder,
  };

  useEffect(() => {
    if (!profileReady || !session?.user?.id) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const nextData = await loadCreatorProfileData(session.user.id);
        if (!cancelled) {
          setData(nextData);
          setForm({
            full_name: nextData.profile.fullName,
            bio: nextData.creator.bio ?? "",
            primary_market: nextData.creator.primaryMarket ?? "",
            languages: nextData.creator.languages,
          });
        }
      } catch {
        if (!cancelled) {
          setError(t("error.generic"));
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
  }, [profileReady, session?.user?.id, t]);

  function toggleLanguage(language: string) {
    setForm((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((value) => value !== language)
        : [...current.languages, language],
    }));
  }

  async function handleSave() {
    if (!session?.user?.id || !data) {
      return;
    }

    const normalized = normalizeCreatorProfileBasics({
      full_name: form.full_name,
      bio: form.bio,
      primary_market: form.primary_market,
      languages: form.languages,
    });
    const validation = validateCreatorProfileBasics(normalized);

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? t("profile.basicsError"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateCreatorProfileBasicsMobile(
        session.user.id,
        data.creator,
        normalized,
      );
      await refreshProfile();
      router.back();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : t("profile.basicsError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between pt-6">
            <Pressable onPress={() => router.back()}>
              <Text
                className="text-sm"
                style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
              >
                {t("action.cancel")}
              </Text>
            </Pressable>
            <Text
              className="text-base"
              style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
            >
              {t("profile.editBasicsTitle")}
            </Text>
            <Pressable onPress={handleSave} disabled={saving || loading}>
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {t("action.save")}
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View className="pt-8">
              {[0, 1, 2].map((index) => (
                <View key={index} className="mb-4">
                  <View
                    className="h-4 w-24 rounded-full"
                    style={{ backgroundColor: palette.skeleton }}
                  />
                  <View
                    className="mt-3 h-12 rounded-2xl"
                    style={{ backgroundColor: palette.surfaceMuted }}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View className="pb-10 pt-8">
              {error ? (
                <View
                  className="mb-5 rounded-2xl border px-4 py-4"
                  style={{
                    backgroundColor: palette.errorSurface,
                    borderColor: palette.errorBorder,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: palette.errorText, fontFamily: "Inter_500Medium" }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              <View className="mb-6">
                <Text
                  className="text-sm"
                  style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
                >
                  {t("profile.fullName")}
                </Text>
                <TextInput
                  value={form.full_name}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, full_name: value }))
                  }
                  className="mt-3 rounded-2xl border px-4 py-4 text-base"
                  placeholder={t("profile.fullName")}
                  placeholderTextColor={palette.inputPlaceholder}
                  style={{
                    backgroundColor: palette.inputBackground,
                    borderColor: palette.inputBorder,
                    color: palette.textPrimary,
                    fontFamily: "Inter_400Regular",
                  }}
                />
              </View>

              <View className="mb-6">
                <Text
                  className="text-sm"
                  style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
                >
                  {t("profile.bio")}
                </Text>
                <TextInput
                  value={form.bio}
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, bio: value }))
                  }
                  multiline
                  textAlignVertical="top"
                  className="mt-3 min-h-[140px] rounded-2xl border px-4 py-4 text-base"
                  placeholder={t("profile.emptyBio")}
                  placeholderTextColor={palette.inputPlaceholder}
                  style={{
                    backgroundColor: palette.inputBackground,
                    borderColor: palette.inputBorder,
                    color: palette.textPrimary,
                    fontFamily: "Inter_400Regular",
                  }}
                />
              </View>

              <View className="mb-6">
                <Text
                  className="text-sm"
                  style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
                >
                  {t("profile.primaryMarket")}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {MARKETS.map((market) => {
                    const selected = form.primary_market === market;
                    return (
                      <Pressable
                        key={market}
                        onPress={() =>
                          setForm((current) => ({
                            ...current,
                            primary_market: market,
                          }))
                        }
                        className={`rounded-full px-4 py-2 ${selected ? "" : "border"}`}
                        style={selected ? selectedPillStyle : unselectedPillStyle}
                      >
                        <Text
                          className="text-sm"
                          style={{
                            color: selected
                              ? palette.buttonPrimaryText
                              : palette.textTertiary,
                            fontFamily: "Inter_500Medium",
                          }}
                        >
                          {MARKET_LABELS[market]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="mb-8">
                <Text
                  className="text-sm"
                  style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
                >
                  {t("profile.languages")}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {LANGUAGES.map((language) => {
                    const selected = form.languages.includes(language);
                    return (
                      <Pressable
                        key={language}
                        onPress={() => toggleLanguage(language)}
                        className={`rounded-full px-4 py-2 ${selected ? "" : "border"}`}
                        style={selected ? selectedPillStyle : unselectedPillStyle}
                      >
                        <Text
                          className="text-sm"
                          style={{
                            color: selected
                              ? palette.buttonPrimaryText
                              : palette.textTertiary,
                            fontFamily: "Inter_500Medium",
                          }}
                        >
                          {LANGUAGE_LABELS[language]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="items-center rounded-xl px-6 py-4"
                style={{
                  backgroundColor: palette.buttonPrimaryBackground,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <Text
                  className="text-sm"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("action.save")}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
