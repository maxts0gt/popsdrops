import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { useAuth } from "../../lib/auth";
import { SymbolGrid } from "../../components/symbol-grid";
import { useI18n } from "../../lib/i18n";
import { getMobileAuthRedirectUrl } from "../../lib/mobile-auth";
import { supabase } from "../../lib/supabase";

/**
 * Login screen — matches the web's dark hero exactly:
 * pure black bg, neutral blurred orbs, character grid at 6% opacity.
 */

const BG = "#000000";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#FFFFFF";
const TEXT_SECONDARY = "#94A3B8"; // slate-400
const TEXT_MUTED = "#64748B"; // slate-500
const BTN_BG = "#FFFFFF";
const BTN_TEXT = "#0F172A"; // slate-900
const INPUT_BG = "rgba(255,255,255,0.06)";
const INPUT_BORDER = "rgba(255,255,255,0.1)";

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSendMagicLink() {
    if (!email.trim()) return;
    setSending(true);
    const redirectUrl = getMobileAuthRedirectUrl(Linking.createURL);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    setSending(false);
    if (!error) {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1" style={{ backgroundColor: BG }}>
        <SymbolGrid />
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="w-full max-w-[360px] rounded-2xl px-6 py-7"
            style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER }}
          >
            <Text
              className="text-2xl"
              style={{ color: TEXT_PRIMARY, fontFamily: "Inter_700Bold" }}
            >
              {t("auth.checkEmail")}
            </Text>
            <Text
              className="mt-3 text-base leading-7"
              style={{ color: TEXT_SECONDARY, fontFamily: "Inter_400Regular" }}
            >
              {t("auth.checkEmailDetail", { email })}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const isDisabled = sending || !email.trim();

  return (
    <View className="flex-1" style={{ backgroundColor: BG }}>
      {/* Neutral gradient orbs — matching web hero */}
      <View pointerEvents="none" className="absolute inset-0">
        <View
          className="absolute rounded-full"
          style={{
            top: "-30%",
            left: "5%",
            width: 400,
            height: 400,
            backgroundColor: "rgba(163,163,163,0.04)",
          }}
        />
        <View
          className="absolute rounded-full"
          style={{
            bottom: "-15%",
            right: "0%",
            width: 300,
            height: 300,
            backgroundColor: "rgba(163,163,163,0.03)",
          }}
        />
        <View
          className="absolute rounded-full"
          style={{
            top: "18%",
            right: "15%",
            width: 200,
            height: 200,
            backgroundColor: "rgba(163,163,163,0.05)",
          }}
        />
      </View>

      {/* Character grid */}
      <SymbolGrid />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        style={{ backgroundColor: "transparent" }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 28,
            paddingVertical: 32,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full" style={{ maxWidth: 360 }}>
            {/* Brand */}
            <View className="items-center">
              <Text
                className="text-5xl"
                style={{ color: TEXT_PRIMARY, fontFamily: "Inter_700Bold" }}
              >
                {t("app.name")}
              </Text>
              <Text
                className="mt-4 text-center text-base leading-7"
                style={{ color: TEXT_SECONDARY, fontFamily: "Inter_400Regular" }}
              >
                {t("auth.subtitle")}
              </Text>
            </View>

            {/* Auth card */}
            <View
              className="mt-12 rounded-2xl px-5 py-6"
              style={{ backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER }}
            >
              {/* Google — white button, dark text (matches web hero CTA) */}
              <Pressable
                onPress={signInWithGoogle}
                className="w-full flex-row items-center justify-center rounded-xl px-6 py-4"
                style={{ backgroundColor: BTN_BG }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                    marginEnd: 8,
                  }}
                >
                  <Text style={{ color: "#4285F4" }}>G</Text>
                  <Text style={{ color: "#EA4335" }}>o</Text>
                  <Text style={{ color: "#FBBC05" }}>o</Text>
                  <Text style={{ color: "#4285F4" }}>g</Text>
                  <Text style={{ color: "#34A853" }}>l</Text>
                  <Text style={{ color: "#EA4335" }}>e</Text>
                </Text>
                <Text
                  className="text-base"
                  style={{
                    color: BTN_TEXT,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("auth.signInGoogle")}
                </Text>
              </Pressable>

              <View className="my-5 flex-row items-center">
                <View className="h-px flex-1" style={{ backgroundColor: BORDER }} />
                <Text
                  className="mx-4 text-xs"
                  style={{ color: TEXT_MUTED, fontFamily: "Inter_500Medium" }}
                >
                  {t("auth.orDivider").toUpperCase()}
                </Text>
                <View className="h-px flex-1" style={{ backgroundColor: BORDER }} />
              </View>

              {!showEmail ? (
                <Pressable
                  onPress={() => setShowEmail(true)}
                  className="w-full items-center rounded-xl px-6 py-4"
                  style={{
                    backgroundColor: INPUT_BG,
                    borderWidth: 1,
                    borderColor: INPUT_BORDER,
                  }}
                >
                  <Text
                    className="text-base"
                    style={{ color: TEXT_PRIMARY, fontFamily: "Inter_600SemiBold" }}
                  >
                    {t("auth.signInEmail")}
                  </Text>
                </Pressable>
              ) : (
                <View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t("auth.emailPlaceholder")}
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-xl px-4 py-4 text-base"
                    style={{
                      backgroundColor: INPUT_BG,
                      borderWidth: 1,
                      borderColor: INPUT_BORDER,
                      color: TEXT_PRIMARY,
                      fontFamily: "Inter_400Regular",
                    }}
                  />
                  <Pressable
                    onPress={handleSendMagicLink}
                    disabled={isDisabled}
                    className="mt-3 w-full items-center rounded-xl px-6 py-4"
                    style={{
                      backgroundColor: BTN_BG,
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color={BTN_TEXT} />
                    ) : (
                      <Text
                        className="text-base"
                        style={{
                          color: BTN_TEXT,
                          fontFamily: "Inter_600SemiBold",
                        }}
                      >
                        {t("auth.sendLink")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
