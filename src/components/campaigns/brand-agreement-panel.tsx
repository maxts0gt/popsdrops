"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, PenLine, Save, ShieldCheck } from "lucide-react";
import {
  createCampaignAgreementUpload,
  publishCampaignAgreement,
  upsertCampaignAgreementDraft,
} from "@/app/actions/campaign-agreements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAgreementFileValidationError } from "@/lib/agreements/agreement-upload";
import type {
  AgreementGateMode,
  AgreementRules,
} from "@/lib/agreements/campaign-agreement";
import { getOrderedAgreementRuleEntries } from "@/lib/agreements/campaign-agreement";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type BrandAgreementRow = {
  id: string;
  campaign_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  gate_mode: AgreementGateMode;
  title: string;
  rules: AgreementRules;
  agreement_body: string | null;
  preview_summary: Record<string, string>;
  file_name: string | null;
  file_mime_type: "application/pdf" | null;
  file_size_bytes: number | null;
  file_sha256: string | null;
  requires_typed_name: boolean;
};

type RuleEditorKey =
  | "disclosure"
  | "claims"
  | "usageRights"
  | "confidentiality"
  | "reporting"
  | "corrections";

type RuleEditorState = Record<RuleEditorKey, string>;

const RULE_EDITOR_KEYS: RuleEditorKey[] = [
  "disclosure",
  "claims",
  "usageRights",
  "confidentiality",
  "reporting",
  "corrections",
];

const RULE_TITLE_KEYS: Record<RuleEditorKey, string> = {
  disclosure: "agreement.rule.disclosure",
  claims: "agreement.rule.claims",
  usageRights: "agreement.rule.usageRights",
  confidentiality: "agreement.rule.confidentiality",
  reporting: "agreement.rule.reporting",
  corrections: "agreement.rule.corrections",
};

const RULE_DEFAULT_KEYS: Record<RuleEditorKey, string> = {
  disclosure: "agreement.rule.disclosure.default",
  claims: "agreement.rule.claims.default",
  usageRights: "agreement.rule.usageRights.default",
  confidentiality: "agreement.rule.confidentiality.default",
  reporting: "agreement.rule.reporting.default",
  corrections: "agreement.rule.corrections.default",
};

async function getFileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getRuleBody(
  agreement: BrandAgreementRow | null,
  key: RuleEditorKey,
  fallback: string,
) {
  const value = agreement?.rules?.[key]?.body;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getRuleTitleKey(key: RuleEditorKey) {
  return RULE_TITLE_KEYS[key];
}

function getRuleDefaultKey(key: RuleEditorKey) {
  return RULE_DEFAULT_KEYS[key];
}

function createRuleEditorState(
  agreement: BrandAgreementRow | null,
  t: (key: string) => string,
): RuleEditorState {
  return Object.fromEntries(
    RULE_EDITOR_KEYS.map((key) => [
      key,
      getRuleBody(agreement, key, t(getRuleDefaultKey(key))),
    ]),
  ) as RuleEditorState;
}

export function BrandAgreementPanel({
  campaignId,
  agreement,
  canManage = true,
  onPublished,
}: {
  campaignId: string;
  agreement: BrandAgreementRow | null;
  canManage?: boolean;
  onPublished?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("brand.campaign");
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [pendingAction, setPendingAction] = useState<"draft" | "publish" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ruleBodies, setRuleBodies] = useState<RuleEditorState>(() =>
    createRuleEditorState(agreement, t),
  );
  const [agreementBody, setAgreementBody] = useState(
    agreement?.agreement_body ?? "",
  );

  const statusLabel = agreement
    ? t(`agreement.status.${agreement.status}`)
    : t("agreement.notConfigured");
  const versionLabel = agreement
    ? t("agreement.version", { version: String(agreement.version) })
    : null;
  const previewItems = agreement
    ? Object.values(agreement.preview_summary)
    : [
        t("agreement.previewSummary.disclosure"),
        t("agreement.previewSummary.reporting"),
        t("agreement.previewSummary.assets"),
      ];
  const hasCompleteRules = RULE_EDITOR_KEYS.every((key) => ruleBodies[key].trim());
  const isBusy = pendingAction !== null;

  const rules = useMemo(() => {
    const nextRules: AgreementRules = { ...(agreement?.rules ?? {}) };
    for (const key of RULE_EDITOR_KEYS) {
      nextRules[key] = {
        title: t(getRuleTitleKey(key)),
        body: ruleBodies[key],
      };
    }
    return nextRules;
  }, [agreement?.rules, ruleBodies, t]);

  const orderedPreviewRules = useMemo(
    () => getOrderedAgreementRuleEntries(rules),
    [rules],
  );

  function getGateMode(): AgreementGateMode {
    if (file || agreementBody.trim() || (agreement?.status === "draft" && agreement.file_name)) {
      return "rules_and_brand_agreement";
    }
    return "typed_signature";
  }

  async function saveAgreementDraft() {
    const retainedDraftFile =
      !file && agreement?.status === "draft" && agreement.file_name
        ? agreement
        : null;
    const fileValidationError = file
      ? getAgreementFileValidationError({
          mimeType: file.type,
          sizeBytes: file.size,
        })
      : null;
    if (fileValidationError) throw new Error(fileValidationError);

    const fileSha256 = file ? await getFileSha256(file) : null;
    const draft = await upsertCampaignAgreementDraft({
      campaignId,
      gateMode: getGateMode(),
      title: t("agreement.title"),
      rules,
      agreementBody: agreementBody.trim() || null,
      previewEnabled: true,
      previewSummary: {
        disclosure: t("agreement.previewSummary.disclosure"),
        reporting: t("agreement.previewSummary.reporting"),
        assets: t("agreement.previewSummary.assets"),
        terms: t("agreement.previewSummary.terms"),
      },
      requiresTypedName: true,
      fileName: file?.name ?? retainedDraftFile?.file_name ?? null,
      fileMimeType: file?.type ?? retainedDraftFile?.file_mime_type ?? null,
      fileSizeBytes: file?.size ?? retainedDraftFile?.file_size_bytes ?? null,
      fileSha256: fileSha256 ?? retainedDraftFile?.file_sha256 ?? null,
    });

    if (file) {
      const upload = await createCampaignAgreementUpload({
        agreementId: draft.id,
        campaignId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(upload.bucket)
        .upload(upload.storagePath, file, {
          contentType: file.type,
          upsert: true,
        });
      if (error) throw new Error(error.message);
    }

    return draft;
  }

  async function handleSaveDraft() {
    if (!canManage) return;
    setPendingAction("draft");
    try {
      await saveAgreementDraft();
      await onPublished?.();
      toast.success(t("agreement.savedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agreement.error"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePublish() {
    if (!canManage) return;
    setPendingAction("publish");
    try {
      const draft = await saveAgreementDraft();
      await publishCampaignAgreement({ agreementId: draft.id });
      await onPublished?.();
      setIsConfiguring(false);
      toast.success(t("agreement.publishedToast"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agreement.error"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      data-testid="brand-agreement-panel"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("agreement.title")}
            </h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {statusLabel}
            </span>
            {versionLabel && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {versionLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("agreement.detail")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {item}
              </span>
            ))}
            {agreement?.file_name && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                <FileText className="size-3" aria-hidden="true" />
                {agreement.file_name}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="brand-agreement-configure"
            onClick={() => setIsConfiguring((value) => !value)}
          >
            <PenLine className="size-3.5" aria-hidden="true" />
            {t("agreement.configure")}
          </Button>
        )}
      </div>

      {isConfiguring && canManage && (
        <div className="mt-4 space-y-5 rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid gap-3 lg:grid-cols-3">
            {RULE_EDITOR_KEYS.map((key) => (
              <div key={key}>
                <Label htmlFor={`agreement-${key}`}>
                  {t(getRuleTitleKey(key))}
                </Label>
                <Textarea
                  id={`agreement-${key}`}
                  value={ruleBodies[key]}
                  onChange={(event) =>
                    setRuleBodies((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-1.5 bg-background text-sm"
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
            <div>
              <Label htmlFor="agreement-body">
                {t("agreement.brandTermsInput")}
              </Label>
              <Textarea
                id="agreement-body"
                value={agreementBody}
                onChange={(event) => setAgreementBody(event.target.value)}
                rows={4}
                placeholder={t("agreement.brandTermsPlaceholder")}
                className="mt-1.5 bg-background text-sm"
              />
            </div>
            <div>
              <Label htmlFor="agreement-file">{t("agreement.uploadPdf")}</Label>
              <Input
                id="agreement-file"
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1.5 bg-background"
              />
              {(file?.name || agreement?.file_name) && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3" aria-hidden="true" />
                  {file?.name ?? agreement?.file_name}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("agreement.creatorPreview")}
            </p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {orderedPreviewRules.map(([key, section]) => (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {section.title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isBusy || !hasCompleteRules}
              onClick={handleSaveDraft}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Save className="size-3.5" aria-hidden="true" />
              {pendingAction === "draft" ? t("agreement.saving") : t("agreement.saveDraft")}
            </button>
            <button
              type="button"
              disabled={isBusy || !hasCompleteRules}
              onClick={handlePublish}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-transparent bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {pendingAction === "publish" ? t("agreement.publishing") : t("agreement.publish")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
