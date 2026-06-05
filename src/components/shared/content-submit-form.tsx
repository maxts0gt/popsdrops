"use client";

import { useState, useTransition } from "react";
import { Link2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icons";
import { PLATFORM_LABELS, type Platform } from "@/lib/constants";
import { submitContent } from "@/app/actions/content";
import { useTranslation } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContentSubmitFormProps {
  campaignMemberId: string;
  platforms: Platform[];
  onSuccess?: () => void;
}

export function ContentSubmitForm({
  campaignMemberId,
  platforms,
  onSuccess,
}: ContentSubmitFormProps) {
  const { t } = useTranslation("creator.campaign");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
    platforms.length === 1 ? platforms[0] : null
  );
  const [contentLink, setContentLink] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    if (!selectedPlatform) {
      setError(t("submit.selectPlatformRequired"));
      return;
    }

    if (!contentLink.trim()) {
      setError(t("submit.contentLinkRequired"));
      return;
    }

    try {
      new URL(contentLink.trim());
    } catch {
      setError(t("submit.contentLinkInvalid"));
      return;
    }

    startTransition(async () => {
      try {
        await submitContent({
          campaign_member_id: campaignMemberId,
          content_url: contentLink.trim(),
          caption: caption.trim() || undefined,
          platform: selectedPlatform,
        });
        setSuccess(true);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("submit.failed"));
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
        <p className="text-sm font-medium text-emerald-900">
          {t("submit.submittedTitle")}
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          {t("submit.submittedDetail")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSuccess(false);
            setContentLink("");
            setCaption("");
            setSelectedPlatform(platforms.length === 1 ? platforms[0] : null);
          }}
        >
          {t("submit.submitAnother")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform selector (if multiple) */}
      {platforms.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t("submit.selectPlatform")}
          </label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => {
              const Icon = PlatformIcon[p];
              const selected = selectedPlatform === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlatform(p)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selected
                      ? "border-foreground bg-foreground text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {PLATFORM_LABELS[p]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Single platform display */}
      {platforms.length === 1 && selectedPlatform && (
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = PlatformIcon[selectedPlatform];
            return <Icon className="size-4 text-muted-foreground" />;
          })()}
          <span className="text-sm font-medium text-foreground">
            {PLATFORM_LABELS[selectedPlatform]}
          </span>
        </div>
      )}

      {/* Content link */}
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          {t("submit.contentLink")} <span className="text-xs text-red-400">*</span>
        </label>
        <div className="relative">
          <Link2 className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="url"
            placeholder={t("submit.contentLinkPlaceholder")}
            value={contentLink}
            onChange={(e) => setContentLink(e.target.value)}
            disabled={!selectedPlatform}
            className="w-full rounded-lg border border-border bg-card py-2.5 pe-3 ps-9 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
          />
        </div>
        {selectedPlatform && (
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            {t("submit.contentLinkHelp")}
          </p>
        )}
      </div>

      {/* Caption / Notes */}
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">
          {t("submit.notesLabel")}
        </label>
        <textarea
          rows={3}
          placeholder={t("submit.notesPlaceholder")}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isPending || !selectedPlatform}
        className="w-full"
      >
        {isPending ? t("submit.submittingDraft") : t("submit.submitDraft")}
      </Button>
    </div>
  );
}
