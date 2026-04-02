"use client";

import { useState, useTransition } from "react";
import { Link2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icons";
import { PLATFORM_LABELS, type Platform } from "@/lib/constants";
import { submitContent } from "@/app/actions/content";

// ---------------------------------------------------------------------------
// URL validation patterns per platform
// ---------------------------------------------------------------------------

const PLATFORM_URL_PATTERNS: Record<Platform, { regex: RegExp; example: string }> = {
  tiktok: {
    regex: /^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+/i,
    example: "https://www.tiktok.com/@username/video/123...",
  },
  instagram: {
    regex: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|stories)\/.+/i,
    example: "https://www.instagram.com/reel/ABC123...",
  },
  youtube: {
    regex: /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/).+/i,
    example: "https://www.youtube.com/watch?v=... or /shorts/...",
  },
  snapchat: {
    regex: /^https?:\/\/(www\.|story\.)?snapchat\.com\/.+/i,
    example: "https://story.snapchat.com/...",
  },
  facebook: {
    regex: /^https?:\/\/(www\.|m\.)?facebook\.com\/.+/i,
    example: "https://www.facebook.com/username/posts/...",
  },
};

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
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
    platforms.length === 1 ? platforms[0] : null
  );
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    if (!selectedPlatform) {
      setError("Select a platform");
      return;
    }

    if (!postUrl.trim()) {
      setError("Paste the URL of your published post");
      return;
    }

    // Validate URL matches platform
    const pattern = PLATFORM_URL_PATTERNS[selectedPlatform];
    if (!pattern.regex.test(postUrl.trim())) {
      setError(
        `URL doesn't look like a ${PLATFORM_LABELS[selectedPlatform]} post. Expected: ${pattern.example}`
      );
      return;
    }

    startTransition(async () => {
      try {
        await submitContent({
          campaign_member_id: campaignMemberId,
          content_url: postUrl.trim(),
          caption: caption.trim() || undefined,
          platform: selectedPlatform,
        });
        setSuccess(true);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
        <p className="text-sm font-medium text-emerald-900">Content submitted</p>
        <p className="mt-1 text-xs text-emerald-700">
          The brand will review your submission and provide feedback.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSuccess(false);
            setPostUrl("");
            setCaption("");
            setSelectedPlatform(platforms.length === 1 ? platforms[0] : null);
          }}
        >
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform selector (if multiple) */}
      {platforms.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Platform
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
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
            return <Icon className="size-4 text-slate-500" />;
          })()}
          <span className="text-sm font-medium text-slate-700">
            {PLATFORM_LABELS[selectedPlatform]}
          </span>
        </div>
      )}

      {/* Post URL */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Post URL <span className="text-xs text-red-400">*</span>
        </label>
        <div className="relative">
          <Link2 className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="url"
            placeholder={
              selectedPlatform
                ? PLATFORM_URL_PATTERNS[selectedPlatform].example
                : "Select a platform first..."
            }
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            disabled={!selectedPlatform}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pe-3 ps-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
          />
        </div>
        {selectedPlatform && (
          <p className="mt-1 text-[11px] text-slate-400">
            Paste the public URL of your published {PLATFORM_LABELS[selectedPlatform]} post
          </p>
        )}
      </div>

      {/* Caption / Notes */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Caption / Notes
        </label>
        <textarea
          rows={3}
          placeholder="Optional: paste the caption you used, or add any notes for the brand..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
        {isPending ? "Submitting..." : "Submit for Review"}
      </Button>
    </div>
  );
}
