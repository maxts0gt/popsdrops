import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { NICHES, NICHE_LABELS } from "../../shared/types";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

export default function EditNichesScreen() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("niches")
        .eq("profile_id", user.id)
        .maybeSingle();
      setSelected(data?.niches ?? []);
      setLoaded(true);
    })();
  }, [user?.id]);

  const toggle = (niche: string) => {
    setSelected((prev) => {
      if (prev.includes(niche)) return prev.filter((n) => n !== niche);
      if (prev.length >= 5) return prev;
      return [...prev, niche];
    });
  };

  const handleSave = useCallback(async () => {
    if (!user?.id || selected.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ niches: selected })
        .eq("profile_id", user.id);
      if (error) throw error;
      router.back();
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [user?.id, selected, router, t]);

  if (!loaded) return null;

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top", "bottom"]}
      style={{ backgroundColor: palette.background }}
    >
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color={palette.textPrimary} strokeWidth={1.8} />
          </Pressable>
          <Text
            className="text-lg"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {t("editNiches.title")}
          </Text>
        </View>
        <Pressable onPress={handleSave} disabled={saving || selected.length === 0}>
          <Text
            className="text-sm"
            style={{
              color: selected.length > 0 ? palette.textPrimary : palette.textMuted,
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
        {t("editNiches.subtitle", { count: selected.length })}
      </Text>

      <ScrollView
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row flex-wrap gap-2.5">
          {NICHES.map((niche) => {
            const isSelected = selected.includes(niche);
            return (
              <Pressable
                key={niche}
                onPress={() => toggle(niche)}
                className="flex-row items-center gap-1.5 rounded-full border px-4 py-2.5"
                style={{
                  backgroundColor: isSelected
                    ? palette.buttonPrimaryBackground
                    : palette.surface,
                  borderColor: isSelected
                    ? palette.buttonPrimaryBackground
                    : palette.inputBorder,
                }}
              >
                {isSelected ? (
                  <Check size={14} color={palette.buttonPrimaryText} strokeWidth={2.5} />
                ) : null}
                <Text
                  className="text-sm"
                  style={{
                    color: isSelected
                      ? palette.buttonPrimaryText
                      : palette.textSecondary,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  {NICHE_LABELS[niche as keyof typeof NICHE_LABELS] ?? niche}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
