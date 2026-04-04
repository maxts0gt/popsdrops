import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { MARKETS, MARKET_LABELS } from "../../shared/types";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

export default function EditMarketsScreen() {
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
        .select("markets")
        .eq("profile_id", user.id)
        .maybeSingle();
      setSelected(data?.markets ?? []);
      setLoaded(true);
    })();
  }, [user?.id]);

  const toggle = (market: string) => {
    setSelected((prev) =>
      prev.includes(market)
        ? prev.filter((m) => m !== market)
        : [...prev, market],
    );
  };

  const handleSave = useCallback(async () => {
    if (!user?.id || selected.length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({ markets: selected })
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
            {t("editMarkets.title")}
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

      <ScrollView
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {MARKETS.map((market) => {
          const isSelected = selected.includes(market);
          return (
            <Pressable
              key={market}
              onPress={() => toggle(market)}
              className="flex-row items-center justify-between border-b py-4"
              style={{ borderColor: palette.borderSubtle }}
            >
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                }}
              >
                {MARKET_LABELS[market as keyof typeof MARKET_LABELS] ?? market}
              </Text>
              {isSelected ? (
                <Check size={18} color={palette.textPrimary} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
