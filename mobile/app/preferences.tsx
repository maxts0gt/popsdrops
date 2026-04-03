import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Moon,
  Monitor,
  Sun,
} from "lucide-react-native";
import { useI18n } from "../lib/i18n";
import { buildLanguageOption } from "../lib/preferences";
import { useTheme } from "../lib/theme-context";

export default function PreferencesScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { palette, preference, setPreference } = useTheme();
  const currentLanguage = buildLanguageOption(locale);

  const themeOptions = [
    { key: "system" as const, label: t("preferences.themeSystem"), icon: Monitor },
    { key: "light" as const, label: t("preferences.themeLight"), icon: Sun },
    { key: "dark" as const, label: t("preferences.themeDark"), icon: Moon },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView
        className="flex-1"
        edges={["top"]}
        style={{ backgroundColor: "transparent" }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row items-center px-6 pt-4">
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <ChevronLeft
                size={20}
                color={palette.textSecondary}
                strokeWidth={1.8}
              />
            </Pressable>
            <Text
              className="ms-4 text-lg"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
            >
              {t("preferences.title")}
            </Text>
          </View>

          {/* ── Appearance ── */}
          <View className="mt-8 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.6px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("preferences.appearanceTitle")}
            </Text>
            <Text
              className="mt-2 text-sm leading-5"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("preferences.appearanceDetail")}
            </Text>

            <View className="mt-4 flex-row gap-3">
              {themeOptions.map((option) => {
                const selected = preference === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setPreference(option.key)}
                    className="flex-1 items-center rounded-2xl py-5"
                    style={{
                      backgroundColor: selected
                        ? palette.buttonPrimaryBackground
                        : palette.surface,
                      borderWidth: 1,
                      borderColor: selected
                        ? "transparent"
                        : palette.borderSubtle,
                    }}
                  >
                    <option.icon
                      size={20}
                      color={
                        selected
                          ? palette.buttonPrimaryText
                          : palette.textTertiary
                      }
                      strokeWidth={1.8}
                    />
                    <Text
                      className="mt-2 text-xs"
                      style={{
                        color: selected
                          ? palette.buttonPrimaryText
                          : palette.textSecondary,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Language ── */}
          <View className="mt-10 px-6">
            <Text
              className="text-[11px] uppercase tracking-[1.6px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("preferences.languageTitle")}
            </Text>
            <Text
              className="mt-2 text-sm leading-5"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("preferences.languageDetail")}
            </Text>

            <Pressable
              onPress={() => router.push("./select-language")}
              className="mt-4 flex-row items-center rounded-2xl px-5 py-4"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: palette.surfaceStrong }}
              >
                <Globe
                  size={18}
                  color={palette.textTertiary}
                  strokeWidth={1.8}
                />
              </View>
              <View className="ms-4 flex-1">
                <Text
                  className="text-[15px]"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {currentLanguage.nativeLabel}
                </Text>
                <Text
                  className="mt-0.5 text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {currentLanguage.englishLabel}
                </Text>
              </View>
              <ChevronRight
                size={18}
                color={palette.textMuted}
                strokeWidth={1.8}
              />
            </Pressable>

            <Text
              className="mt-3 text-xs leading-5"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("preferences.languageSync")}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
