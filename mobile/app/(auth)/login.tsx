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
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

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
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    setSending(false);
    if (!error) {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text
          className="text-2xl text-slate-900"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {t("auth.checkEmail")}
        </Text>
        <Text
          className="mt-3 text-center text-base text-slate-500"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {t("auth.checkEmailDetail", { email })}
        </Text>
      </View>
    );
  }

  const isDisabled = sending || !email.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand header */}
        <Text
          className="text-sm tracking-widest text-slate-400"
          style={{ fontFamily: "Inter_500Medium", letterSpacing: 2 }}
        >
          {t("auth.welcomeBack").toUpperCase()}
        </Text>
        <Text
          className="mt-3 text-4xl text-slate-900"
          style={{ fontFamily: "Inter_700Bold" }}
        >
          {t("app.name")}
        </Text>
        <Text
          className="mt-2 text-base text-slate-500"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {t("auth.subtitle")}
        </Text>

        <View className="mt-10 w-full" style={{ maxWidth: 340 }}>
          {/* Google sign-in */}
          <Pressable
            onPress={signInWithGoogle}
            className="w-full flex-row items-center justify-center rounded-xl bg-slate-900 px-6 py-4"
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
              className="text-base text-white"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              {t("auth.signInGoogle")}
            </Text>
          </Pressable>

          {/* "or" divider */}
          <View className="my-5 flex-row items-center">
            <View className="h-px flex-1 bg-slate-200" />
            <Text
              className="mx-4 text-xs text-slate-400"
              style={{ fontFamily: "Inter_500Medium" }}
            >
              {t("auth.orDivider").toUpperCase()}
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          {/* Email option */}
          {!showEmail ? (
            <Pressable
              onPress={() => setShowEmail(true)}
              className="w-full items-center rounded-xl border border-slate-300 px-6 py-4"
            >
              <Text
                className="text-base text-slate-900"
                style={{ fontFamily: "Inter_600SemiBold" }}
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
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                className="w-full rounded-xl border border-slate-300 px-4 py-4 text-base text-slate-900"
                style={{ fontFamily: "Inter_400Regular" }}
              />
              <Pressable
                onPress={handleSendMagicLink}
                disabled={isDisabled}
                className="mt-3 w-full items-center rounded-xl bg-slate-900 px-6 py-4"
                style={{ opacity: isDisabled ? 0.4 : 1 }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    className="text-base text-white"
                    style={{ fontFamily: "Inter_600SemiBold" }}
                  >
                    {t("auth.sendLink")}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
