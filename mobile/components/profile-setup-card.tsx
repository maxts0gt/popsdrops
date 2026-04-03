import { Pressable, Text, View } from "react-native";
import { Sparkles, ArrowRight } from "lucide-react-native";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";

type ProfileSetupCardProps = {
  onPress: () => void;
};

export function ProfileSetupCard({ onPress }: ProfileSetupCardProps) {
  const { t } = useI18n();
  const { palette } = useTheme();

  return (
    <View
      className="mt-10 items-center rounded-2xl border px-6 py-10"
      style={{ backgroundColor: palette.surfaceMuted, borderColor: palette.borderSubtle }}
    >
      <View
        className="mb-5 h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: palette.buttonPrimaryBackground }}
      >
        <Sparkles size={24} color={palette.buttonPrimaryText} />
      </View>
      <Text
        className="text-center text-lg"
        style={{ color: palette.textPrimary, fontFamily: "Inter_600SemiBold" }}
      >
        {t("home.empty")}
      </Text>
      <Text
        className="mt-2 text-center text-sm leading-5"
        style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
      >
        {t("home.emptyDetail")}
      </Text>
      <Pressable
        onPress={onPress}
        className="mt-6 flex-row items-center rounded-xl px-7 py-3.5"
        style={{ backgroundColor: palette.buttonPrimaryBackground }}
      >
        <Text
          className="text-sm"
          style={{
            color: palette.buttonPrimaryText,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {t("home.completeProfile")}
        </Text>
        <ArrowRight size={16} color={palette.buttonPrimaryText} className="ms-2" />
      </Pressable>
    </View>
  );
}
