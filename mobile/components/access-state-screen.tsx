import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Lock, ShieldAlert } from "lucide-react-native";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme-context";

type AccessStateScreenProps = {
  mode: "loading" | "unsupported_role" | "account_unavailable" | "invitation_required";
};

export function AccessStateScreen({ mode }: AccessStateScreenProps) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const { palette } = useTheme();

  if (mode === "loading") {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }}>
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color={palette.textPrimary} />
          <Text
            className="mt-5 text-base"
            style={{ color: palette.textSecondary, fontFamily: "Inter_500Medium" }}
          >
            {t("loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isInviteRequired = mode === "invitation_required";

  const title = isInviteRequired
    ? t("access.invitationRequiredTitle")
    : mode === "unsupported_role"
      ? t("access.creatorOnlyTitle")
      : t("access.accountUnavailableTitle");

  const detail = isInviteRequired
    ? t("access.invitationRequiredDetail")
    : mode === "unsupported_role"
      ? t("access.creatorOnlyDetail")
      : t("access.accountUnavailableDetail");

  const Icon = isInviteRequired ? Lock : ShieldAlert;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }}>
      <View className="flex-1 justify-center px-6">
        <View
          className="rounded-[28px] border px-6 py-8"
          style={{ backgroundColor: palette.surfaceMuted, borderColor: palette.border }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: palette.buttonPrimaryBackground }}
          >
            <Icon size={24} color={palette.buttonPrimaryText} />
          </View>
          <Text
            className="mt-6 text-2xl"
            style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
          >
            {title}
          </Text>
          <Text
            className="mt-3 text-base leading-6"
            style={{ color: palette.textSecondary, fontFamily: "Inter_400Regular" }}
          >
            {detail}
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
              {t("action.signOut")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
