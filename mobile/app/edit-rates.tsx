import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import {
  PLATFORMS,
  CONTENT_FORMATS,
  PLATFORM_LABELS,
  CONTENT_FORMAT_LABELS,
} from "../../shared/types";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

type RateCard = Record<string, Record<string, number>>;

export default function EditRatesScreen() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [rateCard, setRateCard] = useState<RateCard>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("rate_card")
        .eq("profile_id", user.id)
        .maybeSingle();
      setRateCard((data?.rate_card as RateCard) ?? {});
      setLoaded(true);
    })();
  }, [user?.id]);

  const updateRate = (platform: string, format: string, value: string) => {
    const numVal = value === "" ? 0 : Number(value.replace(/\D/g, ""));
    setRateCard((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] ?? {}),
        [format]: numVal,
      },
    }));
  };

  const getRate = (platform: string, format: string): string => {
    const val = rateCard[platform]?.[format];
    return val ? String(val) : "";
  };

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // Clean empty entries
      const cleaned: RateCard = {};
      for (const [platform, formats] of Object.entries(rateCard)) {
        const nonZero: Record<string, number> = {};
        for (const [format, rate] of Object.entries(formats)) {
          if (rate > 0) nonZero[format] = rate;
        }
        if (Object.keys(nonZero).length > 0) cleaned[platform] = nonZero;
      }

      const { error } = await supabase
        .from("creator_profiles")
        .update({ rate_card: cleaned })
        .eq("profile_id", user.id);
      if (error) throw error;
      router.back();
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [user?.id, rateCard, router, t]);

  if (!loaded) return null;

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top", "bottom"]}
      style={{ backgroundColor: palette.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft
                size={22}
                color={palette.textPrimary}
                strokeWidth={1.8}
              />
            </Pressable>
            <Text
              className="text-lg"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
            >
              {t("editRates.title")}
            </Text>
          </View>
          <Pressable onPress={handleSave} disabled={saving}>
            <Text
              className="text-sm"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("action.save")}
            </Text>
          </Pressable>
        </View>

        <Text
          className="px-6 pt-2 text-sm"
          style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
        >
          {t("editRates.subtitle")}
        </Text>

        <ScrollView
          className="flex-1 px-6 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {PLATFORMS.map((platform) => (
            <View key={platform} className="mb-8">
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform}
              </Text>

              {CONTENT_FORMATS.map((format) => (
                <View
                  key={format}
                  className="mt-3 flex-row items-center justify-between"
                >
                  <Text
                    className="flex-1 text-sm"
                    style={{
                      color: palette.textSecondary,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {CONTENT_FORMAT_LABELS[format as keyof typeof CONTENT_FORMAT_LABELS] ?? format}
                  </Text>
                  <View
                    className="flex-row items-center rounded-xl border px-3"
                    style={{
                      borderColor: palette.inputBorder,
                      backgroundColor: palette.surface,
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: palette.textMuted,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      $
                    </Text>
                    <TextInput
                      value={getRate(platform, format)}
                      onChangeText={(v) => updateRate(platform, format, v)}
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                      keyboardType="numeric"
                      className="w-20 py-2.5 text-right"
                      style={{
                        color: palette.textPrimary,
                        fontFamily: "Inter_500Medium",
                        fontSize: 14,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
