"use client";

import { useState, useTransition } from "react";
import { FileText, PenLine, ShieldCheck } from "lucide-react";
import {
  acceptCampaignAgreement,
  getCampaignAgreementSignedUrl,
} from "@/app/actions/campaign-agreements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AgreementGateMode,
  AgreementRules,
} from "@/lib/agreements/campaign-agreement";
import { getOrderedAgreementRuleEntries } from "@/lib/agreements/campaign-agreement";
import { useTranslation } from "@/lib/i18n";

export type CampaignAgreementGateRow = {
  id: string;
  campaign_id: string;
  version: number;
  gate_mode: AgreementGateMode;
  title: string;
  rules: AgreementRules;
  agreement_body: string | null;
  file_name: string | null;
  requires_typed_name: boolean;
};

export function AgreementGate({
  agreement,
  onAccepted,
}: {
  agreement: CampaignAgreementGateRow;
  onAccepted: () => void;
}) {
  const { t } = useTranslation("creator.campaign");
  const [typedName, setTypedName] = useState("");
  const [hasRead, setHasRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ruleEntries = getOrderedAgreementRuleEntries(agreement.rules);
  const summaryRuleEntries = ruleEntries.slice(0, 4);
  const additionalRuleCount = Math.max(
    ruleEntries.length - summaryRuleEntries.length,
    0,
  );
  const canAccept =
    hasRead &&
    (!agreement.requires_typed_name || typedName.trim().length >= 2);

  function handleOpenAgreement() {
    setError(null);
    startTransition(async () => {
      try {
        const { signedUrl } = await getCampaignAgreementSignedUrl({
          agreementId: agreement.id,
        });
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch {
        setError(t("agreement.fileError"));
      }
    });
  }

  function handleAccept() {
    if (!canAccept) {
      setError(t("agreement.required"));
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await acceptCampaignAgreement({
          agreementId: agreement.id,
          campaignId: agreement.campaign_id,
          typedName,
          acceptedRules: Object.fromEntries(
            ruleEntries.map(([key]) => [key, true]),
          ),
        });
        onAccepted();
      } catch {
        setError(t("agreement.error"));
      }
    });
  }

  return (
    <section
      data-testid="creator-agreement-gate"
      className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)] md:items-start">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {t("agreement.reviewTitle")}
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {agreement.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("agreement.detail")}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 ps-12">
            {summaryRuleEntries.map(([key, section]) => (
              <span
                key={key}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {section.title}
              </span>
            ))}
            {additionalRuleCount > 0 && (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {t("agreement.ruleCount", {
                  count: String(additionalRuleCount),
                })}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("agreement.unlockLabel")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {t("agreement.unlockSummary")}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/25 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t("agreement.ruleLedger")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("agreement.totalRules", { count: String(ruleEntries.length) })}
          </p>
        </div>
        <div className="divide-y divide-border">
          {ruleEntries.map(([key, section], index) => (
            <div
              key={key}
              className="grid gap-2 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)]"
            >
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {section.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {section.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(agreement.agreement_body || agreement.file_name) && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          {agreement.agreement_body && (
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("agreement.brandTerms")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {agreement.agreement_body}
              </p>
            </div>
          )}
          {agreement.file_name && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAgreement}
              disabled={isPending}
            >
              <FileText className="size-3.5" aria-hidden="true" />
              {t("agreement.openFile")}
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("agreement.signatureTitle")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("agreement.signatureDetail")}
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(event) => setHasRead(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                {t("agreement.readConfirm")}
              </span>
            </label>
          </div>

          <div className="space-y-2">
            {agreement.requires_typed_name && (
              <div>
                <label
                  htmlFor="agreement-typed-name"
                  className="text-xs font-medium text-foreground"
                >
                  {t("agreement.typedName")}
                </label>
                <Input
                  id="agreement-typed-name"
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  placeholder={t("agreement.typedNamePlaceholder")}
                  className="mt-1.5 bg-background"
                />
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button
              type="button"
              size="sm"
              disabled={!canAccept || isPending}
              onClick={handleAccept}
              className="w-full"
            >
              <PenLine className="size-3.5" aria-hidden="true" />
              {isPending ? t("agreement.signing") : t("agreement.sign")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
