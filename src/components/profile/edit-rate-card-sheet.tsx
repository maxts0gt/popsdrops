"use client";

import { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  CONTENT_FORMAT_LABELS,
  type Platform,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { updateCreatorProfile } from "@/app/actions/profile";

// Which content formats are relevant per platform
const PLATFORM_FORMATS: Record<Platform, ContentFormat[]> = {
  tiktok: ["short_video"],
  instagram: ["reel", "story", "photo_post", "carousel"],
  snapchat: ["story"],
  youtube: ["short_video", "long_video"],
  facebook: ["short_video", "photo_post"],
};

interface RateCardData {
  [platform: string]: { [format: string]: number };
}

interface EditRateCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRateCard: RateCardData | null;
  connectedPlatforms: Platform[];
  currency: string;
  onSaved: (rateCard: RateCardData) => void;
}

export function EditRateCardSheet({
  open,
  onOpenChange,
  currentRateCard,
  connectedPlatforms,
  currency,
  onSaved,
}: EditRateCardSheetProps) {
  const { locale } = useI18n();
  const [rates, setRates] = useState<RateCardData>(currentRateCard || {});
  const [isPending, startTransition] = useTransition();

  const currencySymbol =
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    })
      .format(0)
      .replace(/[\d.,\s]/g, "") || "$";

  function updateRate(platform: Platform, format: string, value: string) {
    const num = parseInt(value, 10);
    setRates((prev) => {
      const next = { ...prev };
      if (!next[platform]) next[platform] = {};
      if (isNaN(num) || num <= 0) {
        delete next[platform][format];
        if (Object.keys(next[platform]).length === 0) delete next[platform];
      } else {
        next[platform] = { ...next[platform], [format]: num };
      }
      return next;
    });
  }

  function getRate(platform: Platform, format: string): string {
    const val = rates[platform]?.[format];
    return val ? String(val) : "";
  }

  function handleSave() {
    startTransition(async () => {
      await updateCreatorProfile({ rate_card: rates });
      onSaved(rates);
      onOpenChange(false);
    });
  }

  const platforms =
    connectedPlatforms.length > 0
      ? connectedPlatforms
      : (Object.keys(PLATFORM_FORMATS) as Platform[]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Rate Card</SheetTitle>
          <SheetDescription>
            Set your rates per platform and content format ({currency.toUpperCase()}).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          {platforms.map((platform) => {
            const Icon = PlatformIcon[platform];
            const formats = PLATFORM_FORMATS[platform];
            return (
              <div key={platform}>
                <div className="mb-2.5 flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {PLATFORM_LABELS[platform]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {formats.map((format) => (
                    <div key={format}>
                      <Label
                        htmlFor={`${platform}-${format}`}
                        className="mb-1 text-xs text-muted-foreground"
                      >
                        {CONTENT_FORMAT_LABELS[format]}
                      </Label>
                      <div className="relative">
                        <span className="absolute inset-y-0 start-0 flex items-center ps-2.5 text-xs text-muted-foreground/70">
                          {currencySymbol}
                        </span>
                        <Input
                          id={`${platform}-${format}`}
                          type="number"
                          min={0}
                          step={10}
                          placeholder="—"
                          value={getRate(platform, format)}
                          onChange={(e) =>
                            updateRate(platform, format, e.target.value)
                          }
                          className="ps-7 tabular-nums"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save Rates"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
