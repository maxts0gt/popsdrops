import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, Lock } from "lucide-react-native";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";
import {
  FOLLOWER_RANGES,
  PLATFORM_LABELS,
  submitCreatorWaitlist,
  type FollowerRange,
  type WaitlistPlatform,
} from "../lib/waitlist";

type Step = "form" | "submitted";

export function WaitlistScreen() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { palette } = useTheme();

  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name ?? "",
  );
  const [platform, setPlatform] = useState<WaitlistPlatform | null>(null);
  const [socialUrl, setSocialUrl] = useState("");
  const [followerRange, setFollowerRange] = useState<FollowerRange | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const email = user?.email ?? "";
  const canSubmit =
    fullName.trim() && platform && socialUrl.trim() && followerRange;

  async function handleSubmit() {
    if (!canSubmit || !platform || !followerRange) return;
    setSubmitting(true);
    const result = await submitCreatorWaitlist({
      fullName: fullName.trim(),
      email,
      platform,
      socialUrl: socialUrl.trim(),
      followerRange,
    });
    setSubmitting(false);
    if (result.success) {
      setStep("submitted");
    }
  }

  if (step === "submitted") {
    return (
      <SafeAreaView
        className="flex-1"
        style={{ backgroundColor: palette.background }}
      >
        <View className="flex-1 justify-center px-6">
          <View
            className="rounded-[28px] border px-6 py-8"
            style={{
              backgroundColor: palette.surfaceMuted,
              borderColor: palette.border,
            }}
          >
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <CheckCircle size={24} color={palette.buttonPrimaryText} />
            </View>
            <Text
              className="mt-6 text-2xl"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
            >
              {t("waitlist.submittedTitle")}
            </Text>
            <Text
              className="mt-3 text-base leading-6"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("waitlist.submittedDetail")}
            </Text>
            <Pressable
              onPress={signOut}
              className="mt-8 items-center rounded-xl px-6 py-4"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <Text
                className="text-sm"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("action.done")}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: palette.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-6 pt-8">
            <View
              className="h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: palette.buttonPrimaryBackground }}
            >
              <Lock size={20} color={palette.buttonPrimaryText} />
            </View>
            <Text
              className="mt-5 text-[28px] leading-[34px]"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_700Bold",
              }}
            >
              {t("waitlist.title")}
            </Text>
            <Text
              className="mt-2 text-base leading-6"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("waitlist.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View className="mt-8 px-6">
            {/* Name */}
            <Text
              className="text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("waitlist.nameLabel")}
            </Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t("waitlist.namePlaceholder")}
              placeholderTextColor={palette.inputPlaceholder}
              autoCapitalize="words"
              className="mt-2 rounded-xl px-4 py-4 text-base"
              style={{
                backgroundColor: palette.inputBackground,
                borderWidth: 1,
                borderColor: palette.inputBorder,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
              }}
            />

            {/* Email (read-only from Google) */}
            <Text
              className="mt-5 text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("waitlist.emailLabel")}
            </Text>
            <View
              className="mt-2 rounded-xl px-4 py-4"
              style={{
                backgroundColor: palette.surfaceStrong,
                borderWidth: 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <Text
                className="text-base"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {email}
              </Text>
            </View>

            {/* Platform */}
            <Text
              className="mt-5 text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("waitlist.platformLabel")}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {(
                Object.entries(PLATFORM_LABELS) as [WaitlistPlatform, string][]
              ).map(([key, label]) => {
                const selected = platform === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setPlatform(key)}
                    className="rounded-full px-4 py-2.5"
                    style={{
                      backgroundColor: selected
                        ? palette.buttonPrimaryBackground
                        : palette.inputBackground,
                      borderWidth: 1,
                      borderColor: selected
                        ? palette.buttonPrimaryBackground
                        : palette.inputBorder,
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: selected
                          ? palette.buttonPrimaryText
                          : palette.textPrimary,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Social URL */}
            <Text
              className="mt-5 text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("waitlist.socialUrlLabel")}
            </Text>
            <TextInput
              value={socialUrl}
              onChangeText={setSocialUrl}
              placeholder={t("waitlist.socialUrlPlaceholder")}
              placeholderTextColor={palette.inputPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="mt-2 rounded-xl px-4 py-4 text-base"
              style={{
                backgroundColor: palette.inputBackground,
                borderWidth: 1,
                borderColor: palette.inputBorder,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
              }}
            />

            {/* Followers */}
            <Text
              className="mt-5 text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("waitlist.followersLabel")}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {FOLLOWER_RANGES.map((range) => {
                const selected = followerRange === range;
                return (
                  <Pressable
                    key={range}
                    onPress={() => setFollowerRange(range)}
                    className="rounded-full px-4 py-2.5"
                    style={{
                      backgroundColor: selected
                        ? palette.buttonPrimaryBackground
                        : palette.inputBackground,
                      borderWidth: 1,
                      borderColor: selected
                        ? palette.buttonPrimaryBackground
                        : palette.inputBorder,
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: selected
                          ? palette.buttonPrimaryText
                          : palette.textPrimary,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {range}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Submit */}
          <View className="mt-8 px-6">
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              className="items-center rounded-xl px-6 py-4"
              style={{
                backgroundColor: palette.buttonPrimaryBackground,
                opacity: !canSubmit || submitting ? 0.4 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color={palette.buttonPrimaryText}
                />
              ) : (
                <Text
                  className="text-base"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("waitlist.submit")}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={signOut} className="mt-4 items-center py-3">
              <Text
                className="text-sm"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {t("waitlist.signOutInstead")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
