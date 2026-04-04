import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  FileCheck,
  MessageCircle,
  RotateCcw,
  Send,
  Star,
  UserCheck,
  XCircle,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import {
  loadNotifications,
  type AppNotification,
} from "../lib/notifications";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/campaign-actions";
import { useI18n } from "../lib/i18n";
import { formatRelativeTime } from "../lib/relative-time";
import { useTheme } from "../lib/theme-context";

const TYPE_ICONS: Record<string, typeof Bell> = {
  application_received: Send,
  application_accepted: UserCheck,
  application_rejected: XCircle,
  counter_offer: Star,
  content_submitted: FileCheck,
  content_approved: CheckCheck,
  revision_requested: RotateCcw,
  new_message: MessageCircle,
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const router = useRouter();
  const userId = session?.user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await loadNotifications(userId);
      setNotifications(data);
    } catch {
      // Silent
    }
  }, [userId]);

  useEffect(() => {
    void (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleTap = useCallback(
    async (notification: AppNotification) => {
      if (!notification.read) {
        await markNotificationRead(notification.id).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n,
          ),
        );
      }

      // Route based on type
      const data = notification.data ?? {};
      const campaignId = data.campaign_id as string | undefined;

      if (
        notification.type === "application_accepted" &&
        campaignId
      ) {
        router.push({
          pathname: "/campaign-room/[id]",
          params: { id: campaignId },
        });
      } else if (
        notification.type === "new_message" &&
        campaignId
      ) {
        router.push({
          pathname: "/campaign-room/[id]",
          params: { id: campaignId },
        });
      } else if (
        (notification.type === "revision_requested" ||
          notification.type === "content_approved") &&
        campaignId
      ) {
        router.push({
          pathname: "/campaign-room/[id]",
          params: { id: campaignId },
        });
      } else if (campaignId) {
        router.push({
          pathname: "/campaign/[id]",
          params: { id: campaignId },
        });
      }
    },
    [router],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft
              size={22}
              color={palette.textPrimary}
              strokeWidth={1.8}
            />
          </Pressable>
          <Text
            className="text-lg"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_700Bold",
            }}
          >
            {t("notifications.title")}
          </Text>
        </View>
        {hasUnread ? (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text
              className="text-sm"
              style={{
                color: palette.textTertiary,
                fontFamily: "Inter_500Medium",
              }}
            >
              {t("notifications.markAllRead")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList<AppNotification>
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 40,
        }}
        renderItem={({ item }) => {
          const Icon = TYPE_ICONS[item.type] ?? Bell;
          return (
            <Pressable
              onPress={() => handleTap(item)}
              className="flex-row gap-3 px-6 py-4"
              style={{
                backgroundColor: item.read
                  ? palette.background
                  : palette.surface,
              }}
            >
              <View
                className="mt-0.5 h-8 w-8 items-center justify-center rounded-full"
                style={{
                  backgroundColor: item.read
                    ? palette.surfaceMuted
                    : palette.accentSoft,
                }}
              >
                <Icon
                  size={14}
                  color={
                    item.read ? palette.textMuted : palette.textTertiary
                  }
                  strokeWidth={2}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: item.read
                      ? "Inter_400Regular"
                      : "Inter_600SemiBold",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  className="mt-0.5 text-sm"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
                <Text
                  className="mt-1 text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {formatRelativeTime(item.createdAt, { locale })}
                </Text>
              </View>
              {!item.read ? (
                <View
                  className="mt-2 h-2 w-2 rounded-full"
                  style={{ backgroundColor: "#3B82F6" }}
                />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View className="flex-1 items-center justify-center">
              <Bell
                size={32}
                color={palette.textMuted}
                strokeWidth={1.2}
              />
              <Text
                className="mt-4 text-base"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("notifications.empty")}
              </Text>
              <Text
                className="mt-1.5 text-sm"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {t("notifications.emptyDetail")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
