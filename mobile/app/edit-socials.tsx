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
import { PLATFORMS, PLATFORM_LABELS } from "../../shared/types";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

type SocialInput = {
  url: string;
  handle: string;
  followers: string;
};

const EMPTY_SOCIAL: SocialInput = { url: "", handle: "", followers: "" };

export default function EditSocialsScreen() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Record<string, SocialInput>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("tiktok, instagram, snapchat, youtube, facebook")
        .eq("profile_id", user.id)
        .maybeSingle();

      const mapped: Record<string, SocialInput> = {};
      for (const platform of PLATFORMS) {
        const existing = data?.[platform as keyof typeof data] as {
          url?: string;
          handle?: string;
          followers?: number;
        } | null;
        mapped[platform] = existing
          ? {
              url: existing.url ?? "",
              handle: existing.handle ?? "",
              followers: existing.followers ? String(existing.followers) : "",
            }
          : { ...EMPTY_SOCIAL };
      }
      setAccounts(mapped);
      setLoaded(true);
    })();
  }, [user?.id]);

  const updateField = (
    platform: string,
    field: keyof SocialInput,
    value: string,
  ) => {
    setAccounts((prev) => ({
      ...prev,
      [platform]: { ...(prev[platform] ?? EMPTY_SOCIAL), [field]: value },
    }));
  };

  // Auto-extract handle from URL
  const handleUrlChange = (platform: string, url: string) => {
    updateField(platform, "url", url);
    const match = url.match(/(?:@|\/)([\w.]+)\/?$/);
    if (match) {
      updateField(platform, "handle", match[1]);
    }
  };

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const update: Record<string, unknown> = {};
      for (const platform of PLATFORMS) {
        const acc = accounts[platform];
        if (!acc || (!acc.url && !acc.handle)) {
          update[platform] = null;
        } else {
          update[platform] = {
            url: acc.url || null,
            handle: acc.handle || null,
            followers: acc.followers ? Number(acc.followers) : null,
          };
        }
      }

      const { error } = await supabase
        .from("creator_profiles")
        .update(update)
        .eq("profile_id", user.id);
      if (error) throw error;
      router.back();
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [user?.id, accounts, router, t]);

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
              {t("editSocials.title")}
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

        <ScrollView
          className="flex-1 px-6 pt-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {PLATFORMS.map((platform) => {
            const acc = accounts[platform] ?? EMPTY_SOCIAL;
            return (
              <View key={platform} className="mb-6">
                <Text
                  className="text-sm"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform}
                </Text>

                <TextInput
                  value={acc.url}
                  onChangeText={(v) => handleUrlChange(platform, v)}
                  placeholder={t("editSocials.urlPlaceholder")}
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                  className="mt-2 rounded-xl border px-4 py-3"
                  style={{
                    borderColor: palette.inputBorder,
                    backgroundColor: palette.surface,
                    color: palette.textPrimary,
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                  }}
                />

                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    value={acc.handle}
                    onChangeText={(v) => updateField(platform, "handle", v)}
                    placeholder={t("editSocials.handlePlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="none"
                    className="flex-1 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: palette.inputBorder,
                      backgroundColor: palette.surface,
                      color: palette.textPrimary,
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                    }}
                  />
                  <TextInput
                    value={acc.followers}
                    onChangeText={(v) =>
                      updateField(platform, "followers", v.replace(/\D/g, ""))
                    }
                    placeholder={t("editSocials.followersPlaceholder")}
                    placeholderTextColor={palette.textMuted}
                    keyboardType="numeric"
                    className="w-28 rounded-xl border px-4 py-3"
                    style={{
                      borderColor: palette.inputBorder,
                      backgroundColor: palette.surface,
                      color: palette.textPrimary,
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
