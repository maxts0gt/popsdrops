/**
 * Official platform brand icons as SVG components.
 * Used across the entire platform: media kit, profile, campaign cards, discovery.
 * All icons are monochrome-ready but support branded color via className.
 */

import type { Platform } from "@/lib/constants";

interface IconProps {
  className?: string;
}

export function TikTokIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.88a8.18 8.18 0 0 0 4.76 1.52V6.97a4.84 4.84 0 0 1-1-.28z" />
    </svg>
  );
}

export function InstagramIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

export function YouTubeIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function SnapchatIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.969-.228.12-.042.24-.082.36-.117a.93.93 0 0 1 .27-.042c.18 0 .36.06.51.165.225.15.36.435.36.72 0 .54-.585.81-1.17 1.02-.135.045-.27.105-.42.165-.465.195-.975.42-1.065.855-.03.12-.03.255.015.39.105.36.405.66.645.945.075.09.15.165.21.24.63.72 1.29 1.53 1.29 2.445 0 .12-.015.24-.045.36-.195.72-.72 1.23-1.35 1.56-.51.27-1.065.42-1.59.525-.15.03-.285.06-.405.105-.12.045-.24.12-.345.18-.195.09-.42.195-.69.3-.405.15-.885.225-1.455.225a4.58 4.58 0 0 1-.63-.045c-.285-.045-.585-.135-.9-.255a6.12 6.12 0 0 0-.225-.09c-.39-.15-.825-.225-1.26-.225s-.87.075-1.26.225l-.225.09c-.315.12-.615.21-.9.255a4.58 4.58 0 0 1-.63.045c-.57 0-1.05-.075-1.455-.225-.27-.105-.495-.21-.69-.3a2.72 2.72 0 0 0-.345-.18c-.12-.045-.255-.075-.405-.105-.525-.105-1.08-.255-1.59-.525-.63-.33-1.155-.84-1.35-1.56a1.59 1.59 0 0 1-.045-.36c0-.915.66-1.725 1.29-2.445.06-.075.135-.15.21-.24.24-.285.54-.585.645-.945.045-.135.045-.27.015-.39-.09-.435-.6-.66-1.065-.855-.15-.06-.285-.12-.42-.165C.585 13.41 0 13.14 0 12.6c0-.285.135-.57.36-.72a.86.86 0 0 1 .51-.165c.09 0 .18.015.27.042.12.035.24.075.36.117.31.108.669.212.969.228.198 0 .326-.045.401-.09a18.1 18.1 0 0 1-.033-.57c-.104-1.628-.23-3.654.3-4.847C4.86 1.069 8.217.793 9.207.793h.003c.99 0 1.996 0 2.996 0z" />
    </svg>
  );
}

export function FacebookIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/** Map platform key to its icon component */
export const PlatformIcon: Record<Platform, React.FC<IconProps>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  snapchat: SnapchatIcon,
  facebook: FacebookIcon,
};

/** Platform icon with branded background pill */
export function PlatformBadge({
  platform,
  size = "md",
}: {
  platform: Platform;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = PlatformIcon[platform];

  const bgColors: Record<Platform, string> = {
    tiktok: "bg-slate-900 text-white",
    instagram: "bg-gradient-to-br from-purple-500 to-pink-500 text-white",
    snapchat: "bg-yellow-400 text-slate-900",
    youtube: "bg-red-600 text-white",
    facebook: "bg-blue-600 text-white",
  };

  const sizes = {
    sm: "size-7 [&_svg]:size-3.5",
    md: "size-10 [&_svg]:size-5",
    lg: "size-12 [&_svg]:size-6",
  };

  return (
    <div
      className={`flex items-center justify-center rounded-lg ${bgColors[platform]} ${sizes[size]}`}
    >
      <Icon />
    </div>
  );
}

/** Small inline platform icon (for chips, tags, lists) */
export function PlatformChip({
  platform,
}: {
  platform: Platform;
}) {
  const Icon = PlatformIcon[platform];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
      <Icon className="size-3.5" />
      {platform === "tiktok" ? "TikTok" : platform === "instagram" ? "Instagram" : platform === "youtube" ? "YouTube" : platform === "snapchat" ? "Snapchat" : "Facebook"}
    </span>
  );
}
