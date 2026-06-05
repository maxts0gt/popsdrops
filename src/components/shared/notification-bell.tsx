"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getNotificationBellState } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ href }: { href: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let unsubscribeNotifications: (() => void) | undefined;

    async function load() {
      const bellState = await getNotificationBellState().catch(() => null);
      if (!isMounted || !bellState) return;

      if (isMounted) setUnreadCount(bellState.unreadCount);
      if (!isMounted) return;

      // Subscribe to new notifications
      const channel = supabase
        .channel(`bell:${bellState.userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${bellState.userId}`,
          },
          () => {
            if (isMounted) setUnreadCount((prev) => prev + 1);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${bellState.userId}`,
          },
          () => {
            // Re-fetch count on any update (mark as read)
            supabase
              .from("notifications")
              .select("*", { count: "exact", head: true })
              .eq("user_id", bellState.userId)
              .eq("read", false)
              .then(({ count }) => {
                if (isMounted) setUnreadCount(count ?? 0);
              });
          },
        )
        .subscribe();

      unsubscribeNotifications = () => {
        void supabase.removeChannel(channel);
      };
    }

    void load();

    return () => {
      isMounted = false;
      unsubscribeNotifications?.();
    };
  }, []);

  return (
    <Link
      href={href}
      className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className="absolute end-1 top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-primary-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
      <span className="sr-only">Notifications</span>
    </Link>
  );
}
