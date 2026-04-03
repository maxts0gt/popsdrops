import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, Search } from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import {
  buildLanguagePickerModel,
  type LanguageOption,
} from "../lib/preferences";
import { persistProfileLocalePreference } from "../lib/preferences-data";
import { useTheme } from "../lib/theme-context";

function LanguageRow({
  option,
  active,
  busy,
  onPress,
  palette,
}: {
  option: LanguageOption;
  active: boolean;
  busy: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl px-4 py-3.5"
      style={{
        backgroundColor: active ? palette.buttonPrimaryBackground : "transparent",
      }}
    >
      <View className="flex-1">
        <Text
          className="text-[15px]"
          style={{
            color: active ? palette.buttonPrimaryText : palette.textPrimary,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {option.nativeLabel}
        </Text>
        <Text
          className="mt-0.5 text-xs"
          style={{
            color: active ? palette.buttonPrimaryText : palette.textMuted,
            fontFamily: "Inter_400Regular",
            opacity: active ? 0.7 : 1,
          }}
        >
          {option.englishLabel}
        </Text>
      </View>

      {busy ? (
        <ActivityIndicator
          size="small"
          color={active ? palette.buttonPrimaryText : palette.textPrimary}
        />
      ) : active ? (
        <Check size={18} color={palette.buttonPrimaryText} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

function LanguageSection({
  title,
  options,
  activeLocale,
  savingCode,
  onSelect,
  palette,
}: {
  title: string;
  options: LanguageOption[];
  activeLocale: string;
  savingCode: string | null;
  onSelect: (code: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  if (options.length === 0) return null;

  return (
    <View className="mt-8">
      <Text
        className="px-1 text-[11px] uppercase tracking-[1.6px]"
        style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
      >
        {title}
      </Text>
      <View
        className="mt-3 overflow-hidden rounded-2xl"
        style={{
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.borderSubtle,
        }}
      >
        {options.map((option, index) => (
          <React.Fragment key={option.code}>
            {index > 0 ? (
              <View
                className="mx-4"
                style={{
                  height: 1,
                  backgroundColor: palette.borderSubtle,
                }}
              />
            ) : null}
            <LanguageRow
              option={option}
              active={option.code === activeLocale}
              busy={savingCode === option.code}
              onPress={() => onSelect(option.code)}
              palette={palette}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function SelectLanguageScreen() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const { t, locale, setLocale, deviceLocales } = useI18n();
  const { palette } = useTheme();
  const [query, setQuery] = useState("");
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const model = useMemo(
    () =>
      buildLanguagePickerModel({
        currentLocale: locale,
        deviceLocales,
        query,
      }),
    [deviceLocales, locale, query],
  );

  async function handleSelect(code: string) {
    setSavingCode(code);
    setLocale(code);

    if (session?.user?.id) {
      try {
        await persistProfileLocalePreference(session.user.id, code);
        await refreshProfile();
      } catch (error) {
        console.error("Failed to persist mobile locale preference:", error);
      }
    }

    setSavingCode(null);
    router.back();
  }

  return (
    <View className="flex-1" style={{ backgroundColor: palette.background }}>
      <SafeAreaView
        className="flex-1"
        edges={["top"]}
        style={{ backgroundColor: "transparent" }}
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
            {t("preferences.languageTitle")}
          </Text>
        </View>

        {/* Search */}
        <View className="mt-5 px-6">
          <View
            className="flex-row items-center rounded-xl px-4 py-3"
            style={{
              backgroundColor: palette.inputBackground,
              borderWidth: 1,
              borderColor: palette.inputBorder,
            }}
          >
            <Search
              size={16}
              color={palette.textMuted}
              strokeWidth={1.8}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("preferences.languageSearch")}
              placeholderTextColor={palette.inputPlaceholder}
              className="ms-3 flex-1 text-[15px]"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
              }}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {model.custom ? (
            <View className="mt-8">
              <Text
                className="px-1 text-[11px] uppercase tracking-[1.6px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("preferences.languageCustom")}
              </Text>
              <View
                className="mt-3 overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.borderSubtle,
                }}
              >
                <LanguageRow
                  option={model.custom}
                  active={model.custom.code === locale}
                  busy={savingCode === model.custom.code}
                  onPress={() => handleSelect(model.custom!.code)}
                  palette={palette}
                />
              </View>
            </View>
          ) : null}

          <LanguageSection
            title={t("preferences.languagePinned")}
            options={model.pinned}
            activeLocale={locale}
            savingCode={savingCode}
            onSelect={handleSelect}
            palette={palette}
          />

          <LanguageSection
            title={t("preferences.languageSuggested")}
            options={model.suggested}
            activeLocale={locale}
            savingCode={savingCode}
            onSelect={handleSelect}
            palette={palette}
          />

          <LanguageSection
            title={t("preferences.languageAll")}
            options={model.rest}
            activeLocale={locale}
            savingCode={savingCode}
            onSelect={handleSelect}
            palette={palette}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
