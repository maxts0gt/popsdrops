"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const returnTo = searchParams.get("returnTo");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { t } = useTranslation("auth.login");

  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${
          returnTo ? `?next=${returnTo}` : ""
        }`,
      },
    });
    if (error) {
      toast.error(t("error.generic"));
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${
          returnTo ? `?next=${returnTo}` : ""
        }`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(t("error.magicLink"));
    } else {
      setMagicLinkSent(true);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/[0.03]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Mail className="h-6 w-6 text-slate-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {t("magicLink.sent")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("magicLink.sentTo")} <strong>{email}</strong>
        </p>
        <p className="mt-4 text-xs text-slate-400">
          {t("magicLink.noReceive")}{" "}
          <button
            onClick={() => setMagicLinkSent(false)}
            className="font-medium text-slate-900 hover:underline"
          >
            {t("magicLink.tryAgain")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("subtitle")}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {t("error.authFailed")}
        </div>
      )}

      {/* Google OAuth */}
      <Button
        variant="outline"
        className="mt-6 w-full gap-2"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {t("google")}
      </Button>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-slate-400">{t("or")}</span>
        <Separator className="flex-1" />
      </div>

      {/* Magic Link */}
      <form onSubmit={handleMagicLink}>
        <Label htmlFor="email" className="text-sm text-slate-700">
          {t("email.label")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={t("email.placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1.5"
        />
        <Button type="submit" className="mt-3 w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("magicLink")
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        {t("noAccount")}{" "}
        <a
          href="/request-invite"
          className="font-medium text-slate-900 hover:underline"
        >
          {t("requestInvite")}
        </a>
      </p>

      <p className="mt-3 text-center text-xs text-slate-400">
        {t("legal.agree")}{" "}
        <a href="/terms" className="font-medium text-slate-900 hover:underline">
          {t("legal.terms")}
        </a>{" "}
        {t("legal.and")}{" "}
        <a href="/privacy" className="font-medium text-slate-900 hover:underline">
          {t("legal.privacy")}
        </a>
      </p>
    </div>
  );
}
