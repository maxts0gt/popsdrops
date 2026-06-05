"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useTransition } from "react";
import { KeyRound, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type VerifiedFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string;
  factor_type?: string;
};

type EnrollmentState = {
  factorId: string;
  challengeId: string;
  qrCode: string;
  secret: string;
};

export function MfaSettingsPanel() {
  const { t } = useTranslation("settings");
  const [loading, setLoading] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState<VerifiedFactor | null>(
    null,
  );
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isPending, startTransition] = useTransition();

  const refreshFactors = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      toast.error(t("mfa.loadError"));
      setLoading(false);
      return;
    }

    const factor =
      data?.totp?.find((item) => item.status === "verified") ?? null;
    setVerifiedFactor(factor);
    setLoading(false);
  }, [t]);

  async function removeUnverifiedTotpFactors() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) throw error;

    const unverifiedTotpFactors =
      data?.all?.filter(
        (factor) =>
          factor.factor_type === "totp" && factor.status === "unverified",
      ) ?? [];

    for (const factor of unverifiedTotpFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (unenrollError) throw unenrollError;
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshFactors();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshFactors]);

  function startEnrollment() {
    startTransition(() => {
      void (async () => {
        const supabase = createClient();
        try {
          await removeUnverifiedTotpFactors();
        } catch {
          toast.error(t("mfa.enrollError"));
          return;
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "PopsDrops",
        });

        if (error) {
          toast.error(t("mfa.enrollError"));
          return;
        }

        const { data: challenge, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId: data.id });

        if (challengeError) {
          toast.error(t("mfa.enrollError"));
          return;
        }

        setEnrollment({
          factorId: data.id,
          challengeId: challenge.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
        setVerificationCode("");
        toast.success(t("mfa.enrollSuccess"));
      })();
    });
  }

  function verifyEnrollment() {
    if (!enrollment) return;

    startTransition(() => {
      void (async () => {
        const supabase = createClient();
        const { error } = await supabase.auth.mfa.verify({
          factorId: enrollment.factorId,
          challengeId: enrollment.challengeId,
          code: verificationCode.trim(),
        });

        if (error) {
          toast.error(t("mfa.verifyError"));
          return;
        }

        setEnrollment(null);
        setVerificationCode("");
        await refreshFactors();
        toast.success(t("mfa.verifySuccess"));
      })();
    });
  }

  function cancelEnrollment() {
    const factorId = enrollment?.factorId;
    setEnrollment(null);
    setVerificationCode("");

    if (!factorId) return;

    startTransition(() => {
      void (async () => {
        const supabase = createClient();
        await supabase.auth.mfa.unenroll({ factorId });
      })();
    });
  }

  function removeFactor() {
    if (!verifiedFactor) return;

    startTransition(() => {
      void (async () => {
        const supabase = createClient();
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: verifiedFactor.id,
        });

        if (error) {
          toast.error(t("mfa.removeError"));
          return;
        }

        setVerifiedFactor(null);
        toast.success(t("mfa.removeSuccess"));
      })();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t("mfa.loading")}
        </span>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 p-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              {t("security.mfa")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t(
                verifiedFactor
                  ? "mfa.factorEnabled"
                  : "mfa.factorDisabled",
              )}
            </p>
          </div>
        </div>
        {verifiedFactor ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeFactor}
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            {t("mfa.remove")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEnrollment}
            disabled={isPending || Boolean(enrollment)}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <KeyRound className="size-3.5" />
            )}
            {t("mfa.start")}
          </Button>
        )}
      </div>

      {enrollment && (
        <div className="grid gap-4 rounded-xl border border-border/70 p-3 sm:grid-cols-[auto_1fr]">
          <div className="flex size-36 items-center justify-center rounded-xl bg-white ring-1 ring-border">
            {enrollment.qrCode ? (
              <Image
                src={enrollment.qrCode.trimEnd()}
                alt={t("mfa.qrAlt")}
                width={128}
                height={128}
                unoptimized
              />
            ) : (
              <QrCode className="size-10 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("mfa.secretLabel")}
              </p>
              <p className="mt-1 break-all rounded-lg bg-muted px-2.5 py-2 font-mono text-xs text-foreground">
                {enrollment.secret}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="mfa-code">{t("mfa.codeLabel")}</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(event.target.value)
                  }
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEnrollment}
                  disabled={isPending}
                >
                  {t("mfa.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={verifyEnrollment}
                  disabled={isPending || verificationCode.trim().length < 6}
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {t("mfa.verify")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
