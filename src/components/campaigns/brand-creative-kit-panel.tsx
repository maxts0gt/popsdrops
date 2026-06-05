"use client";

import Link from "next/link";
import NextImage from "next/image";
import { Image as ImageIcon, Upload, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  createCampaignAssetUpload,
  markCampaignAssetReady,
} from "@/app/actions/campaign-assets";
import { Button } from "@/components/ui/button";
import {
  getCreativeKitReadiness,
  pickCreatorFacingHeroAsset,
  type CampaignCreativeAsset,
} from "@/lib/campaigns/creative-kit";
import { getCampaignAssetFileValidationError } from "@/lib/campaigns/creative-kit-upload";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

export function BrandCreativeKitPanel({
  campaignId,
  assets,
  canManage = true,
  onChanged,
}: {
  campaignId: string;
  assets: CampaignCreativeAsset[];
  canManage?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("brand.campaign");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const heroAsset = pickCreatorFacingHeroAsset(assets);
  const readiness = getCreativeKitReadiness(assets);
  const memberAssetCount = assets.filter(
    (asset) => asset.visibility === "member" && asset.status === "ready",
  ).length;

  async function handleFile(file: File | null) {
    if (!canManage) return;
    if (!file) return;

    const validationError = getCampaignAssetFileValidationError({
      mimeType: file.type,
      sizeBytes: file.size,
      assetType: "product_image",
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);
    try {
      const upload = await createCampaignAssetUpload({
        campaignId,
        title: file.name.replace(/\.[^.]+$/, "") || t("creativeKit.image"),
        description: null,
        assetType: "product_image",
        visibility: "public",
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

      await markCampaignAssetReady({
        campaignId,
        assetId: upload.assetId,
      });
      await onChanged?.();
      toast.success(t("creativeKit.uploadedToast"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("creativeKit.uploadError"),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section
      data-testid="brand-creative-kit-panel"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ImageIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t("creativeKit.title")}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {readiness.isDiscoverReady ? (
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                ) : null}
                {readiness.isDiscoverReady
                  ? t("creativeKit.creatorReady")
                  : t("creativeKit.creatorMissing")}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("creativeKit.detail")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/i/discover/${campaignId}`}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {t("creativeKit.preview")}
          </Link>
          {canManage && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant={heroAsset ? "outline" : "default"}
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-3.5" aria-hidden="true" />
                {uploading
                  ? t("creativeKit.uploading")
                  : heroAsset
                    ? t("creativeKit.changeImage")
                    : t("creativeKit.addImage")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(220px,0.45fr)]">
        <div className="relative h-44 overflow-hidden rounded-lg border border-border bg-muted/30">
          {heroAsset?.signedUrl ? (
            <NextImage
              src={heroAsset.signedUrl}
              alt={heroAsset.title}
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {t("creativeKit.empty")}
            </div>
          )}
        </div>
        <div className="grid content-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">
              {t("creativeKit.visibleBeforeApply")}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {heroAsset ? "1" : "0"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">
              {t("creativeKit.privateAfterJoin")}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {memberAssetCount}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
