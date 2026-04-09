"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { PlatformBadge } from "@/components/platform-icons";
import { PLATFORM_LABELS, OAUTH_PLATFORMS, type Platform } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { normalizeCreatorSocialAccount } from "@/lib/creator-socials";
import { updateCreatorProfile } from "@/app/actions/profile";
import type { SocialAccount } from "@/types/database";

interface ConnectPlatformSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Platform;
  currentAccount: SocialAccount | null;
  onSaved: (platform: Platform, account: SocialAccount | null) => void;
}

export function ConnectPlatformSheet({
  open,
  onOpenChange,
  platform,
  currentAccount,
  onSaved,
}: ConnectPlatformSheetProps) {
  const { t } = useTranslation("creator.profile");
  const { t: tc } = useTranslation("ui.common");
  const [url, setUrl] = useState(currentAccount?.url || "");
  const [handle, setHandle] = useState(currentAccount?.handle || "");
  const [followers, setFollowers] = useState(
    currentAccount?.followers ? String(currentAccount.followers) : ""
  );
  const [isPending, startTransition] = useTransition();
  const normalizedInput = useMemo(() => {
    if (!url.trim()) {
      return { account: null, error: null as string | null };
    }

    try {
      return {
        account: normalizeCreatorSocialAccount({
          platform,
          value: url,
        }),
        error: null as string | null,
      };
    } catch (error) {
      return {
        account: null,
        error:
          error instanceof Error
            ? error.message
            : "Enter a valid social handle or profile link",
      };
    }
  }, [platform, url]);

  const onUrlChange = useCallback(
    (value: string) => {
      setUrl(value);
      try {
        const normalized = normalizeCreatorSocialAccount({
          platform,
          value,
        });
        if (normalized.handle) setHandle(normalized.handle);
      } catch {
        setHandle("");
      }
    },
    [platform]
  );

  function handleSave() {
    const followerCount = parseInt(followers, 10);
    if (!url.trim() || !handle.trim() || isNaN(followerCount) || followerCount < 0) {
      return;
    }

    if (!normalizedInput.account) {
      return;
    }

    const account: SocialAccount = {
      url: normalizedInput.account.url,
      handle: handle.trim()
        ? handle.trim().startsWith("@")
          ? handle.trim()
          : `@${handle.trim().replace(/^@/, "")}`
        : normalizedInput.account.handle,
      followers: followerCount,
      verified: currentAccount?.verified || false,
    };

    startTransition(async () => {
      await updateCreatorProfile({ [platform]: account });
      onSaved(platform, account);
      onOpenChange(false);
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await updateCreatorProfile({ [platform]: null });
      onSaved(platform, null);
      onOpenChange(false);
    });
  }

  const isValid =
    Boolean(normalizedInput.account) &&
    handle.trim().length > 0 &&
    parseInt(followers, 10) > 0;

  const platformLabel = PLATFORM_LABELS[platform];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <PlatformBadge platform={platform} size="sm" />
            <div>
              <SheetTitle>
                {currentAccount
                  ? t("connectSheet.editTitle", { platform: platformLabel })
                  : t("connectSheet.connectTitle", { platform: platformLabel })}
              </SheetTitle>
              <SheetDescription>
                {currentAccount
                  ? t("connectSheet.editDescription")
                  : t("connectSheet.connectDescription")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {/* OAuth connect option (primary for supported platforms, not shown for already-connected) */}
          {!currentAccount &&
            (OAUTH_PLATFORMS as readonly string[]).includes(platform) && (
              <>
                <a
                  href={`/auth/social/connect/${platform}`}
                  className="flex items-center gap-3 rounded-xl bg-slate-950 p-4 text-white transition-colors hover:bg-slate-800"
                >
                  <ShieldCheck className="size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t("connectSheet.oauthConnect", { platform: platformLabel })}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {t("connectSheet.oauthDescription")}
                    </p>
                  </div>
                </a>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground/70">
                    {t("connectSheet.orManually")}
                  </span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}

          <div>
            <Label htmlFor="platform-url" className="mb-1.5 text-xs text-muted-foreground">
              {t("connectSheet.profileUrl")}
            </Label>
            <Input
              id="platform-url"
              type="text"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="@yourhandle"
              autoFocus
            />
            {normalizedInput.error && (
              <p className="mt-1 text-[11px] text-red-500">{normalizedInput.error}</p>
            )}
          </div>

          <div>
            <Label htmlFor="platform-handle" className="mb-1.5 text-xs text-muted-foreground">
              {t("connectSheet.handle")}
            </Label>
            <Input
              id="platform-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@username"
            />
          </div>

          <div>
            <Label
              htmlFor="platform-followers"
              className="mb-1.5 text-xs text-muted-foreground"
            >
              {t("connectSheet.followers")}
            </Label>
            <Input
              id="platform-followers"
              type="number"
              min={0}
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="e.g. 50000"
              className="tabular-nums"
            />
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {t("connectSheet.followersHint")}
            </p>
          </div>
        </div>

        <SheetFooter>
          <div className="flex w-full flex-col gap-2">
            <Button
              onClick={handleSave}
              disabled={isPending || !isValid}
              className="w-full"
            >
              {isPending ? t("connectSheet.saving") : tc("action.save")}
            </Button>
            {currentAccount && (
              <Button
                variant="ghost"
                onClick={handleDisconnect}
                disabled={isPending}
                className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {t("connectSheet.disconnectAccount")}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
