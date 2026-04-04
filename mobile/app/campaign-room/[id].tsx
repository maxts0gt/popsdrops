import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  FileText,
  CheckSquare,
  Upload,
  MessageCircle,
  Send,
  ExternalLink,
  AlertCircle,
  Check,
  Clock,
  RotateCcw,
} from "lucide-react-native";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";
import { useAuth } from "../../lib/auth";
import {
  loadCampaignRoom,
  type CampaignRoomData,
  type Deliverable,
  type ContentSubmission,
} from "../../lib/campaign-room";
import {
  loadCampaignMessages,
  subscribeToCampaignMessages,
  type ChatMessage,
} from "../../lib/campaign-chat";
import {
  submitContent,
  publishContent,
  sendCampaignMessage,
} from "../../lib/campaign-actions";

type RoomTab = "brief" | "tasks" | "submit" | "chat";

const PLATFORM_DISPLAY: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
  youtube: "YouTube",
  facebook: "Facebook",
};

const FORMAT_DISPLAY: Record<string, string> = {
  short_video: "Short Video",
  long_video: "Long Video",
  story: "Story",
  reel: "Reel",
  post: "Post",
  carousel: "Carousel",
  live: "Live Stream",
};

export default function CampaignRoomScreen() {
  const { palette } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    brandName: string;
  }>();

  const [activeTab, setActiveTab] = useState<RoomTab>("brief");
  const [data, setData] = useState<CampaignRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadChat, setUnreadChat] = useState(false);
  const chatListRef = useRef<FlatList>(null);

  // Submit state
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitCaption, setSubmitCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [publishUrl, setPublishUrl] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id || !params.id) return;
    try {
      const roomData = await loadCampaignRoom(params.id, user.id);
      setData(roomData);
    } catch (err) {
      console.error("Failed to load campaign room:", err);
    }
  }, [user?.id, params.id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  // Load chat messages
  useEffect(() => {
    if (!user?.id || !params.id) return;
    void loadCampaignMessages(params.id, user.id).then(setMessages).catch(() => {});
  }, [user?.id, params.id]);

  // Subscribe to realtime chat
  useEffect(() => {
    if (!user?.id || !params.id) return;

    const channel = subscribeToCampaignMessages(
      params.id,
      user.id,
      (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (activeTab !== "chat") setUnreadChat(true);
      },
    );

    return () => {
      void channel.unsubscribe();
    };
  }, [user?.id, params.id, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (user?.id && params.id) {
      const msgs = await loadCampaignMessages(params.id, user.id).catch(() => []);
      setMessages(msgs);
    }
    setRefreshing(false);
  }, [loadData, user?.id, params.id]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !params.id || !user?.id) return;
    const text = chatInput.trim();
    setSending(true);
    try {
      const result = await sendCampaignMessage({
        campaign_id: params.id,
        content: text,
      });
      setChatInput("");
      // Optimistically add to local state (realtime may also deliver it — dedup by id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.id)) return prev;
        return [
          ...prev,
          {
            id: result.id,
            campaignId: params.id,
            senderId: user.id,
            senderName: "You",
            senderAvatarUrl: null,
            content: text,
            createdAt: result.created_at,
            isOwn: true,
          },
        ];
      });
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSending(false);
    }
  }, [chatInput, params.id, user?.id, t]);

  const handleSubmitContent = useCallback(async () => {
    if (!data || !submitUrl.trim()) return;
    const deliverable = data.deliverables[0];
    if (!deliverable) return;

    setSubmitting(true);
    try {
      await submitContent({
        campaign_member_id: data.member.id,
        content_url: submitUrl.trim(),
        caption: submitCaption.trim() || undefined,
        platform: deliverable.platform,
      });
      setSubmitUrl("");
      setSubmitCaption("");
      await loadData();
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [data, submitUrl, submitCaption, loadData, t]);

  const handlePublish = useCallback(
    async (submissionId: string) => {
      if (!publishUrl.trim()) return;
      setPublishing(true);
      try {
        await publishContent(submissionId, publishUrl.trim());
        setPublishUrl("");
        await loadData();
      } catch (err) {
        Alert.alert(t("error.generic"), (err as Error).message);
      } finally {
        setPublishing(false);
      }
    },
    [publishUrl, loadData, t],
  );

  const tabs: { key: RoomTab; icon: typeof FileText; label: string }[] = [
    { key: "brief", icon: FileText, label: t("room.brief") },
    { key: "tasks", icon: CheckSquare, label: t("room.tasks") },
    { key: "submit", icon: Upload, label: t("room.submit") },
    { key: "chat", icon: MessageCircle, label: t("room.chat") },
  ];

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: palette.background }}
      >
        <ActivityIndicator size="large" color={palette.textMuted} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top", "bottom"]}
      style={{ backgroundColor: palette.background }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-4 px-6 pt-4 pb-2">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={palette.textPrimary} strokeWidth={1.8} />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-base"
            style={{
              color: palette.textPrimary,
              fontFamily: "Inter_600SemiBold",
            }}
            numberOfLines={1}
          >
            {params.title ?? data?.brief.title}
          </Text>
          <Text
            className="text-xs"
            style={{
              color: palette.textMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {params.brandName ?? data?.brief.brandName}
          </Text>
        </View>
      </View>

      {/* Tab bar */}
      <View
        className="flex-row border-b px-2"
        style={{ borderColor: palette.borderSubtle }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                if (tab.key === "chat") setUnreadChat(false);
              }}
              className="flex-1 items-center py-3"
              style={
                isActive
                  ? {
                      borderBottomWidth: 2,
                      borderBottomColor: palette.textPrimary,
                    }
                  : undefined
              }
            >
              <View className="relative">
                <Icon
                  size={18}
                  color={
                    isActive ? palette.textPrimary : palette.textMuted
                  }
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {tab.key === "chat" && unreadChat ? (
                  <View
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: "#EF4444" }}
                  />
                ) : null}
              </View>
              <Text
                className="mt-1 text-[10px]"
                style={{
                  color: isActive ? palette.textPrimary : palette.textMuted,
                  fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "brief" && data ? (
        <BriefTab
          brief={data.brief}
          deliverables={data.deliverables}
          palette={palette}
          t={t}
          locale={locale}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      ) : null}

      {activeTab === "tasks" && data ? (
        <TasksTab
          deliverables={data.deliverables}
          submissions={data.submissions}
          palette={palette}
          t={t}
        />
      ) : null}

      {activeTab === "submit" && data ? (
        <SubmitTab
          data={data}
          submitUrl={submitUrl}
          setSubmitUrl={setSubmitUrl}
          submitCaption={submitCaption}
          setSubmitCaption={setSubmitCaption}
          submitting={submitting}
          onSubmit={handleSubmitContent}
          publishUrl={publishUrl}
          setPublishUrl={setPublishUrl}
          publishing={publishing}
          onPublish={handlePublish}
          palette={palette}
          t={t}
        />
      ) : null}

      {activeTab === "chat" ? (
        <ChatTab
          messages={messages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sending={sending}
          onSend={handleSendMessage}
          chatListRef={chatListRef}
          palette={palette}
          t={t}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Brief Tab
// ---------------------------------------------------------------------------

function BriefTab({
  brief,
  deliverables,
  palette,
  t,
  locale,
  refreshing,
  onRefresh,
}: {
  brief: CampaignRoomData["brief"];
  deliverables: Deliverable[];
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
  locale: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const formatDate = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(new Date(d))
      : null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Description */}
      {brief.briefDescription ? (
        <View>
          <SectionLabel text={t("room.description")} palette={palette} />
          <Text
            className="mt-2 text-sm leading-6"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_400Regular",
            }}
          >
            {brief.briefDescription}
          </Text>
        </View>
      ) : null}

      {/* Requirements */}
      {brief.briefRequirements ? (
        <View className="mt-6">
          <SectionLabel text={t("room.requirements")} palette={palette} />
          <Text
            className="mt-2 text-sm leading-6"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_400Regular",
            }}
          >
            {brief.briefRequirements}
          </Text>
        </View>
      ) : null}

      {/* Do's & Don'ts */}
      {brief.briefDos ? (
        <View className="mt-6">
          <SectionLabel text={t("room.dos")} palette={palette} />
          <Text
            className="mt-2 text-sm leading-6"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_400Regular",
            }}
          >
            {brief.briefDos}
          </Text>
        </View>
      ) : null}

      {brief.briefDonts ? (
        <View className="mt-6">
          <SectionLabel text={t("room.donts")} palette={palette} />
          <Text
            className="mt-2 text-sm leading-6"
            style={{
              color: palette.textSecondary,
              fontFamily: "Inter_400Regular",
            }}
          >
            {brief.briefDonts}
          </Text>
        </View>
      ) : null}

      {/* Deliverables */}
      {deliverables.length > 0 ? (
        <View className="mt-6">
          <SectionLabel text={t("room.deliverables")} palette={palette} />
          {deliverables.map((d) => (
            <View
              key={d.id}
              className="mt-3 rounded-xl border px-4 py-3"
              style={{
                borderColor: palette.borderSubtle,
                backgroundColor: palette.surface,
              }}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-sm"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {PLATFORM_DISPLAY[d.platform] ?? d.platform}
                </Text>
                <Text
                  className="text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_500Medium",
                  }}
                >
                  {d.quantity}x {FORMAT_DISPLAY[d.contentType] ?? d.contentType}
                </Text>
              </View>
              {d.notes ? (
                <Text
                  className="mt-2 text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {d.notes}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Timeline */}
      <View className="mt-6">
        <SectionLabel text={t("room.timeline")} palette={palette} />
        <View
          className="mt-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: palette.borderSubtle,
            backgroundColor: palette.surface,
          }}
        >
          {brief.contentDueDate ? (
            <TimelineRow
              label={t("room.contentDue")}
              value={formatDate(brief.contentDueDate)!}
              palette={palette}
            />
          ) : null}
          {brief.postingWindowStart ? (
            <TimelineRow
              label={t("room.postingStart")}
              value={formatDate(brief.postingWindowStart)!}
              palette={palette}
            />
          ) : null}
          {brief.postingWindowEnd ? (
            <TimelineRow
              label={t("room.postingEnd")}
              value={formatDate(brief.postingWindowEnd)!}
              palette={palette}
            />
          ) : null}
          <TimelineRow
            label={t("room.maxRevisions")}
            value={String(brief.maxRevisions)}
            palette={palette}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function SectionLabel({
  text,
  palette,
}: {
  text: string;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <Text
      className="text-[11px] uppercase tracking-[1.4px]"
      style={{ color: palette.textMuted, fontFamily: "Inter_600SemiBold" }}
    >
      {text}
    </Text>
  );
}

function TimelineRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text
        className="text-sm"
        style={{
          color: palette.textMuted,
          fontFamily: "Inter_400Regular",
        }}
      >
        {label}
      </Text>
      <Text
        className="text-sm"
        style={{
          color: palette.textPrimary,
          fontFamily: "Inter_500Medium",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tasks Tab
// ---------------------------------------------------------------------------

function TasksTab({
  deliverables,
  submissions,
  palette,
  t,
}: {
  deliverables: Deliverable[];
  submissions: ContentSubmission[];
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  const statusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <Check size={16} color="#10B981" strokeWidth={2.5} />;
      case "approved":
        return <Check size={16} color="#10B981" strokeWidth={2} />;
      case "submitted":
        return <Clock size={16} color="#F59E0B" strokeWidth={2} />;
      case "revision_requested":
        return <RotateCcw size={16} color="#EF4444" strokeWidth={2} />;
      default:
        return <AlertCircle size={16} color={palette.textMuted} strokeWidth={1.5} />;
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      {deliverables.map((d) => {
        const sub = submissions.find(
          (s) => s.platform === d.platform,
        );
        const status = sub?.status ?? "not_started";

        return (
          <View
            key={d.id}
            className="mb-3 flex-row items-center gap-3 rounded-xl border px-4 py-4"
            style={{
              borderColor: palette.borderSubtle,
              backgroundColor: palette.surface,
            }}
          >
            {statusIcon(status)}
            <View className="flex-1">
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {d.quantity}x{" "}
                {FORMAT_DISPLAY[d.contentType] ?? d.contentType}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {PLATFORM_DISPLAY[d.platform] ?? d.platform}
              </Text>
            </View>
            <Text
              className="text-xs"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_500Medium",
              }}
            >
              {t(`room.status.${status}`)}
            </Text>
          </View>
        );
      })}

      {deliverables.length === 0 ? (
        <View className="items-center py-12">
          <Text
            className="text-sm"
            style={{
              color: palette.textMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {t("room.noDeliverables")}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Submit Tab
// ---------------------------------------------------------------------------

function SubmitTab({
  data,
  submitUrl,
  setSubmitUrl,
  submitCaption,
  setSubmitCaption,
  submitting,
  onSubmit,
  publishUrl,
  setPublishUrl,
  publishing,
  onPublish,
  palette,
  t,
}: {
  data: CampaignRoomData;
  submitUrl: string;
  setSubmitUrl: (v: string) => void;
  submitCaption: string;
  setSubmitCaption: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  publishUrl: string;
  setPublishUrl: (v: string) => void;
  publishing: boolean;
  onPublish: (submissionId: string) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  // Find latest submission
  const latestSub = data.submissions[0] ?? null;
  const needsRevision = latestSub?.status === "revision_requested";
  const isApproved = latestSub?.status === "approved";
  const isPublished = latestSub?.status === "published";
  const isSubmitted = latestSub?.status === "submitted";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current status */}
        {latestSub ? (
          <View
            className="mb-6 rounded-xl border px-4 py-4"
            style={{
              borderColor: palette.borderSubtle,
              backgroundColor: palette.surface,
            }}
          >
            <Text
              className="text-xs uppercase tracking-[1.2px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.currentStatus")}
            </Text>
            <Text
              className="mt-2 text-sm"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t(`room.status.${latestSub.status}`)} (v{latestSub.version})
            </Text>
            {latestSub.contentUrl ? (
              <View className="mt-2 flex-row items-center gap-1">
                <ExternalLink
                  size={12}
                  color={palette.textMuted}
                  strokeWidth={1.5}
                />
                <Text
                  className="text-xs"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_400Regular",
                  }}
                  numberOfLines={1}
                >
                  {latestSub.contentUrl}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Revision feedback */}
        {needsRevision && latestSub?.feedback ? (
          <View
            className="mb-6 rounded-xl border-l-4 px-4 py-4"
            style={{
              backgroundColor: "#FEF2F2",
              borderLeftColor: "#EF4444",
            }}
          >
            <Text
              className="text-xs uppercase tracking-[1.2px]"
              style={{
                color: "#991B1B",
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.revisionFeedback")}
            </Text>
            <Text
              className="mt-2 text-sm leading-5"
              style={{ color: "#7F1D1D", fontFamily: "Inter_400Regular" }}
            >
              {latestSub.feedback}
            </Text>
            <Text
              className="mt-2 text-xs"
              style={{ color: "#991B1B", fontFamily: "Inter_500Medium" }}
            >
              {t("room.revisionCount", {
                current: latestSub.revisionCount,
                max: data.brief.maxRevisions,
              })}
            </Text>
          </View>
        ) : null}

        {/* Submit new content (or revision) */}
        {!isSubmitted && !isApproved && !isPublished ? (
          <View>
            <SectionLabel
              text={
                needsRevision
                  ? t("room.submitRevision")
                  : t("room.submitContent")
              }
              palette={palette}
            />

            <Text
              className="mt-3 text-xs uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.contentUrl")}
            </Text>
            <TextInput
              value={submitUrl}
              onChangeText={setSubmitUrl}
              placeholder="https://"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              className="mt-2 rounded-xl border px-4 py-3.5"
              style={{
                borderColor: palette.inputBorder,
                backgroundColor: palette.surface,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
              }}
            />

            <Text
              className="mt-5 text-xs uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.caption")}
            </Text>
            <TextInput
              value={submitCaption}
              onChangeText={setSubmitCaption}
              placeholder={t("room.captionPlaceholder")}
              placeholderTextColor={palette.textMuted}
              multiline
              className="mt-2 rounded-xl border px-4 py-3.5"
              style={{
                borderColor: palette.inputBorder,
                backgroundColor: palette.surface,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
                minHeight: 80,
              }}
            />

            <Pressable
              onPress={onSubmit}
              disabled={submitting || !submitUrl.trim()}
              className="mt-6 items-center rounded-xl py-4"
              style={{
                backgroundColor: palette.buttonPrimaryBackground,
                opacity: submitting || !submitUrl.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color={palette.buttonPrimaryText}
                />
              ) : (
                <Text
                  className="text-sm"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {needsRevision
                    ? t("room.submitRevision")
                    : t("room.submitContent")}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Publish flow */}
        {isApproved && latestSub ? (
          <View>
            <SectionLabel
              text={t("room.publishContent")}
              palette={palette}
            />
            <Text
              className="mt-2 text-sm"
              style={{
                color: palette.textSecondary,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("room.publishDescription")}
            </Text>

            <TextInput
              value={publishUrl}
              onChangeText={setPublishUrl}
              placeholder="https://"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              className="mt-4 rounded-xl border px-4 py-3.5"
              style={{
                borderColor: palette.inputBorder,
                backgroundColor: palette.surface,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
              }}
            />

            <Pressable
              onPress={() => onPublish(latestSub.id)}
              disabled={publishing || !publishUrl.trim()}
              className="mt-4 items-center rounded-xl py-4"
              style={{
                backgroundColor: palette.buttonPrimaryBackground,
                opacity: publishing || !publishUrl.trim() ? 0.5 : 1,
              }}
            >
              {publishing ? (
                <ActivityIndicator
                  size="small"
                  color={palette.buttonPrimaryText}
                />
              ) : (
                <Text
                  className="text-sm"
                  style={{
                    color: palette.buttonPrimaryText,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("room.markPublished")}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Published confirmation */}
        {isPublished && latestSub ? (
          <View className="items-center py-8">
            <Check size={40} color="#10B981" strokeWidth={2} />
            <Text
              className="mt-4 text-base"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.contentPublished")}
            </Text>
            {latestSub.publishedUrl ? (
              <Text
                className="mt-2 text-sm"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
                numberOfLines={1}
              >
                {latestSub.publishedUrl}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Waiting for review */}
        {isSubmitted ? (
          <View className="items-center py-8">
            <Clock size={40} color="#F59E0B" strokeWidth={1.5} />
            <Text
              className="mt-4 text-base"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.waitingReview")}
            </Text>
            <Text
              className="mt-2 text-center text-sm"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("room.waitingReviewDetail")}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Chat Tab
// ---------------------------------------------------------------------------

function ChatTab({
  messages,
  chatInput,
  setChatInput,
  sending,
  onSend,
  chatListRef,
  palette,
  t,
}: {
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  chatListRef: React.RefObject<FlatList | null>;
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={chatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 8,
          flexGrow: 1,
          justifyContent: messages.length === 0 ? "center" : "flex-end",
        }}
        onContentSizeChange={() =>
          chatListRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => (
          <View
            className={`mb-3 max-w-[80%] ${item.isOwn ? "self-end" : "self-start"}`}
          >
            {!item.isOwn ? (
              <Text
                className="mb-1 text-[10px]"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {item.senderName}
              </Text>
            ) : null}
            <View
              className="rounded-2xl px-4 py-3"
              style={{
                backgroundColor: item.isOwn
                  ? palette.buttonPrimaryBackground
                  : palette.surface,
                borderWidth: item.isOwn ? 0 : 1,
                borderColor: palette.borderSubtle,
              }}
            >
              <Text
                className="text-sm leading-5"
                style={{
                  color: item.isOwn
                    ? palette.buttonPrimaryText
                    : palette.textPrimary,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {item.content}
              </Text>
            </View>
            <Text
              className={`mt-1 text-[10px] ${item.isOwn ? "text-right" : ""}`}
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center">
            <MessageCircle
              size={32}
              color={palette.textMuted}
              strokeWidth={1.2}
            />
            <Text
              className="mt-3 text-sm"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("room.noMessages")}
            </Text>
          </View>
        }
      />

      {/* Message input */}
      <View
        className="flex-row items-end gap-2 border-t px-4 py-3"
        style={{
          borderColor: palette.borderSubtle,
          backgroundColor: palette.background,
        }}
      >
        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder={t("room.messagePlaceholder")}
          placeholderTextColor={palette.textMuted}
          multiline
          maxLength={5000}
          className="min-h-[40px] max-h-[120px] flex-1 rounded-2xl border px-4 py-2.5"
          style={{
            borderColor: palette.inputBorder,
            backgroundColor: palette.surface,
            color: palette.textPrimary,
            fontFamily: "Inter_400Regular",
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={onSend}
          disabled={sending || !chatInput.trim()}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor:
              chatInput.trim()
                ? palette.buttonPrimaryBackground
                : palette.surfaceStrong,
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={palette.buttonPrimaryText} />
          ) : (
            <Send
              size={16}
              color={
                chatInput.trim()
                  ? palette.buttonPrimaryText
                  : palette.textMuted
              }
              strokeWidth={2}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
