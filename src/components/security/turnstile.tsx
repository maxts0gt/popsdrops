"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

interface TurnstileProps {
  onTokenChange: (token: string | null) => void;
}

export function Turnstile({ onTokenChange }: TurnstileProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const [scriptReady, setScriptReady] = useState(false);
  const containerId = useId().replace(/:/g, "");
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey && process.env.NODE_ENV !== "production") {
      onTokenChange("dev-turnstile-bypass");
      return;
    }

    onTokenChange(null);
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile || widgetId.current) {
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    widgetId.current = window.turnstile.render(container, {
      sitekey: siteKey,
      theme: "light",
      callback: (token: string) => onTokenChange(token),
      "expired-callback": () => onTokenChange(null),
      "error-callback": () => onTokenChange(null),
    });

    return () => {
      if (widgetId.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [containerId, onTokenChange, scriptReady, siteKey]);

  return (
    <div className="space-y-2">
      {siteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
        />
      ) : null}

      <div id={containerId} className="min-h-16" />

      {!siteKey && process.env.NODE_ENV !== "production" ? (
        <p className="text-xs text-slate-400">
          Bot check is bypassed in local development.
        </p>
      ) : null}
    </div>
  );
}
