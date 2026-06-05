import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  FileText,
  CheckSquare,
  Upload,
  ExternalLink,
  AlertCircle,
  Check,
  Clock,
  PenLine,
  RotateCcw,
  ShieldCheck,
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
  getDeliverableSubmission,
  getInitialRoomTab,
  getLatestPerformanceRead,
  getOpenReportTask,
  getSelectedDeliverableId,
  hasAtLeastOneMetric,
  parseOptionalMetric,
  type CampaignRoomTab,
} from "../../lib/campaign-room-state";
import {
  acceptCampaignAgreement,
  submitContent,
  publishContent,
  submitPerformance,
  uploadPerformanceEvidenceFile,
  type PerformanceEvidenceFile,
} from "../../lib/campaign-actions";

const PROOF_DOCUMENT_PICKER_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
] as const;

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

const AGREEMENT_RULE_ORDER = [
  "role",
  "disclosure",
  "claims",
  "usageRights",
  "confidentiality",
  "timeline",
  "reporting",
  "corrections",
] as const;

function getAgreementRuleEntries(
  rules: NonNullable<CampaignRoomData["agreement"]>["rules"],
) {
  const knownEntries = AGREEMENT_RULE_ORDER.flatMap((key) => {
    const section = rules[key];
    return section ? [[key, section] as const] : [];
  });
  const extraEntries = Object.entries(rules)
    .filter(([key]) => !(AGREEMENT_RULE_ORDER as readonly string[]).includes(key))
    .sort(([left], [right]) => left.localeCompare(right));

  return [...knownEntries, ...extraEntries];
}

export default function CampaignRoomScreen() {
  const { palette } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    brandName: string;
    tab?: string | string[];
  }>();
  const userId = user?.id ?? null;
  const campaignId = typeof params.id === "string" ? params.id : null;

  const [activeTab, setActiveTab] = useState<CampaignRoomTab>(() =>
    getInitialRoomTab(params.tab),
  );
  const [data, setData] = useState<CampaignRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Submit state
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitCaption, setSubmitCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [publishUrl, setPublishUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [metricInputs, setMetricInputs] = useState({
    views: "",
    likes: "",
    comments: "",
    shares: "",
    saves: "",
  });
  const [proofUrl, setProofUrl] = useState("");
  const [proofFile, setProofFile] = useState<PerformanceEvidenceFile | null>(null);
  const [submittingPerformance, setSubmittingPerformance] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId || !campaignId) return;
    try {
      const roomData = await loadCampaignRoom(campaignId, userId);
      setData(roomData);
    } catch (err) {
      console.error("Failed to load campaign room:", err);
    }
  }, [campaignId, userId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(getInitialRoomTab(params.tab));
  }, [params.tab]);

  useEffect(() => {
    if (!data) return;
    setSelectedDeliverableId((currentId) =>
      getSelectedDeliverableId(data.deliverables, currentId),
    );
  }, [data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSubmitContent = useCallback(async () => {
    if (!data || !submitUrl.trim()) return;
    const deliverable =
      data.deliverables.find((item) => item.id === selectedDeliverableId) ??
      data.deliverables[0];
    if (!deliverable) return;

    setSubmitting(true);
    try {
      await submitContent({
        campaign_member_id: data.member.id,
        deliverable_id: deliverable.id,
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
  }, [data, loadData, selectedDeliverableId, submitCaption, submitUrl, t]);

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

  const handlePickProofFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...PROOF_DOCUMENT_PICKER_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    setProofFile({
      uri: asset.uri,
      name: asset.name || "performance-proof",
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    });
  }, []);

  const handleSubmitPerformance = useCallback(
    async (submissionId: string, reportTaskId?: string | null) => {
      if (!hasAtLeastOneMetric(metricInputs)) {
        Alert.alert(t("error.generic"), t("room.performanceMetricRequired"));
        return;
      }
      if (!proofFile && !proofUrl.trim()) {
        Alert.alert(t("error.generic"), t("room.performanceProofRequired"));
        return;
      }
      if (proofFile && !reportTaskId) {
        Alert.alert(t("error.generic"), t("room.performanceProofTaskRequired"));
        return;
      }

      setSubmittingPerformance(true);
      try {
        const uploadedEvidence = proofFile
          ? await uploadPerformanceEvidenceFile({
              reportTaskId: reportTaskId as string,
              submissionId,
              file: proofFile,
            })
          : null;

        await submitPerformance({
          submission_id: submissionId,
          report_task_id: reportTaskId ?? undefined,
          evidence_id: uploadedEvidence?.id,
          measurement_type: "final_7d",
          views: parseOptionalMetric(metricInputs.views),
          likes: parseOptionalMetric(metricInputs.likes),
          comments: parseOptionalMetric(metricInputs.comments),
          shares: parseOptionalMetric(metricInputs.shares),
          saves: parseOptionalMetric(metricInputs.saves),
          screenshot_url: (uploadedEvidence?.storageUri ?? proofUrl.trim()) || undefined,
        });
        setMetricInputs({
          views: "",
          likes: "",
          comments: "",
          shares: "",
          saves: "",
        });
        setProofUrl("");
        setProofFile(null);
        await loadData();
      } catch (err) {
        Alert.alert(t("error.generic"), (err as Error).message);
      } finally {
        setSubmittingPerformance(false);
      }
    },
    [loadData, metricInputs, proofFile, proofUrl, t],
  );

  const tabs: { key: CampaignRoomTab; icon: typeof FileText; label: string }[] = [
    { key: "brief", icon: FileText, label: t("room.brief") },
    { key: "tasks", icon: CheckSquare, label: t("room.tasks") },
    { key: "submit", icon: Upload, label: t("room.submit") },
  ];
  const isAgreementLocked = Boolean(
    data?.agreement &&
      data.agreementStatus.status !== "signed" &&
      data.agreementStatus.status !== "not_required",
  );

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

      {isAgreementLocked && data?.agreement ? (
        <AgreementGateCard
          data={data}
          palette={palette}
          t={t}
          onAccepted={loadData}
        />
      ) : (
        <>
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
              selectedDeliverableId={selectedDeliverableId}
              onSelectDeliverable={setSelectedDeliverableId}
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
              metricInputs={metricInputs}
              setMetricInputs={setMetricInputs}
              proofUrl={proofUrl}
              setProofUrl={setProofUrl}
              proofFile={proofFile}
              onPickProofFile={handlePickProofFile}
              submittingPerformance={submittingPerformance}
              onSubmitPerformance={handleSubmitPerformance}
              palette={palette}
              t={t}
            />
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

function AgreementGateCard({
  data,
  palette,
  t,
  onAccepted,
}: {
  data: CampaignRoomData;
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
  onAccepted: () => Promise<void>;
}) {
  const [hasRead, setHasRead] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [signing, setSigning] = useState(false);
  const agreement = data.agreement;
  const ruleEntries = useMemo(
    () => (agreement ? getAgreementRuleEntries(agreement.rules) : []),
    [agreement],
  );
  const canSign =
    hasRead &&
    agreement != null &&
    (!agreement.requiresTypedName || typedName.trim().length >= 2);

  const handleSign = useCallback(async () => {
    if (!agreement || !canSign) return;
    setSigning(true);
    try {
      await acceptCampaignAgreement({
        agreementId: agreement.id,
        campaignId: data.brief.id,
        typedName,
        acceptedRules: Object.fromEntries(
          ruleEntries.map(([key]) => [key, true]),
        ),
      });
      await onAccepted();
    } catch (err) {
      Alert.alert(t("error.generic"), (err as Error).message);
    } finally {
      setSigning(false);
    }
  }, [agreement, canSign, data.brief.id, onAccepted, ruleEntries, t, typedName]);

  if (!agreement) return null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      <View
        className="rounded-2xl border px-5 py-5"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.borderSubtle,
        }}
      >
        <View className="flex-row items-start gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: palette.accentSoft }}
          >
            <ShieldCheck
              size={18}
              color={palette.textTertiary}
              strokeWidth={1.8}
            />
          </View>
          <View className="flex-1">
            <Text
              className="text-base"
              style={{
                color: palette.textPrimary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {agreement.title}
            </Text>
            <Text
              className="mt-1 text-xs leading-5"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_400Regular",
              }}
            >
              {t("room.agreementDetail")}
            </Text>
          </View>
        </View>

        <View className="mt-5 gap-3">
          {ruleEntries.map(([key, rule]) => (
            <View
              key={key}
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: palette.borderSubtle,
                backgroundColor: palette.background,
              }}
            >
              <Text
                className="text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {rule.title}
              </Text>
              <Text
                className="mt-1 text-xs leading-5"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {rule.body}
              </Text>
            </View>
          ))}
          {agreement.fileName ? (
            <View
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: palette.borderSubtle,
                backgroundColor: palette.background,
              }}
            >
              <Text
                className="text-xs"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_500Medium",
                }}
              >
                {t("room.agreementFile")}
              </Text>
              <Text
                className="mt-1 text-sm"
                style={{
                  color: palette.textPrimary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {agreement.fileName}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => setHasRead((value) => !value)}
          className="mt-5 flex-row items-start gap-3"
        >
          <View
            className="mt-0.5 h-5 w-5 items-center justify-center rounded border"
            style={{
              borderColor: hasRead ? palette.textPrimary : palette.inputBorder,
              backgroundColor: hasRead ? palette.textPrimary : "transparent",
            }}
          >
            {hasRead ? (
              <Check size={13} color={palette.background} strokeWidth={2.4} />
            ) : null}
          </View>
          <Text
            className="flex-1 text-xs leading-5"
            style={{
              color: palette.textMuted,
              fontFamily: "Inter_400Regular",
            }}
          >
            {t("room.agreementReadConfirm")}
          </Text>
        </Pressable>

        {agreement.requiresTypedName ? (
          <View className="mt-5">
            <Text
              className="text-xs uppercase tracking-[1.4px]"
              style={{
                color: palette.textMuted,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {t("room.agreementTypedName")}
            </Text>
            <TextInput
              value={typedName}
              onChangeText={setTypedName}
              placeholder={t("room.agreementTypedNamePlaceholder")}
              placeholderTextColor={palette.textMuted}
              className="mt-2 rounded-xl border px-4 py-3.5"
              style={{
                borderColor: palette.inputBorder,
                backgroundColor: palette.background,
                color: palette.textPrimary,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
              }}
            />
          </View>
        ) : null}

        <Pressable
          onPress={handleSign}
          disabled={!canSign || signing}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-xl py-4"
          style={{
            backgroundColor: palette.buttonPrimaryBackground,
            opacity: !canSign || signing ? 0.5 : 1,
          }}
        >
          {signing ? (
            <ActivityIndicator size="small" color={palette.buttonPrimaryText} />
          ) : (
            <>
              <PenLine
                size={16}
                color={palette.buttonPrimaryText}
                strokeWidth={2}
              />
              <Text
                className="text-sm"
                style={{
                  color: palette.buttonPrimaryText,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {t("room.agreementSign")}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
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

function MetricRead({
  label,
  value,
  palette,
}: {
  label: string;
  value: number | null;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View
      className="min-w-[132px] flex-1 rounded-xl border px-3 py-3"
      style={{
        borderColor: palette.borderSubtle,
        backgroundColor: palette.background,
      }}
    >
      <Text
        className="text-[11px]"
        style={{ color: palette.textMuted, fontFamily: "Inter_500Medium" }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        className="mt-1 text-sm"
        style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
      >
        {value == null ? "-" : new Intl.NumberFormat("en").format(value)}
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
        const sub = getDeliverableSubmission(d, submissions);
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
  selectedDeliverableId,
  onSelectDeliverable,
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
  metricInputs,
  setMetricInputs,
  proofUrl,
  setProofUrl,
  proofFile,
  onPickProofFile,
  submittingPerformance,
  onSubmitPerformance,
  palette,
  t,
}: {
  data: CampaignRoomData;
  selectedDeliverableId: string | null;
  onSelectDeliverable: (deliverableId: string) => void;
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
  metricInputs: Record<"views" | "likes" | "comments" | "shares" | "saves", string>;
  setMetricInputs: (
    value: Record<"views" | "likes" | "comments" | "shares" | "saves", string>,
  ) => void;
  proofUrl: string;
  setProofUrl: (value: string) => void;
  proofFile: PerformanceEvidenceFile | null;
  onPickProofFile: () => void;
  submittingPerformance: boolean;
  onSubmitPerformance: (
    submissionId: string,
    reportTaskId?: string | null,
  ) => void;
  palette: ReturnType<typeof useTheme>["palette"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  const selectedDeliverable =
    data.deliverables.find((deliverable) => deliverable.id === selectedDeliverableId) ??
    data.deliverables[0] ??
    null;
  const latestSub = selectedDeliverable
    ? getDeliverableSubmission(selectedDeliverable, data.submissions)
    : null;
  const needsRevision = latestSub?.status === "revision_requested";
  const isApproved = latestSub?.status === "approved";
  const isPublished = latestSub?.status === "published";
  const isSubmitted = latestSub?.status === "submitted";
  const latestPerformance = getLatestPerformanceRead(
    latestSub?.id,
    data.performance,
  );
  const openReportTask = getOpenReportTask(data.reportTasks);
  const performanceNeedsCorrection = openReportTask?.status === "needs_revision";

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
        {data.deliverables.length > 0 ? (
          <View className="mb-6">
            <SectionLabel text={t("room.deliverables")} palette={palette} />
            <View className="mt-3 gap-2">
              {data.deliverables.map((deliverable) => {
                const isSelected = deliverable.id === selectedDeliverable?.id;
                return (
                  <Pressable
                    key={deliverable.id}
                    onPress={() => onSelectDeliverable(deliverable.id)}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      borderColor: isSelected
                        ? palette.textPrimary
                        : palette.borderSubtle,
                      backgroundColor: isSelected
                        ? palette.accentSoft
                        : palette.surface,
                    }}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <Text
                        className="text-sm"
                        style={{
                          color: palette.textPrimary,
                          fontFamily: "Inter_600SemiBold",
                        }}
                      >
                        {PLATFORM_DISPLAY[deliverable.platform] ?? deliverable.platform}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{
                          color: palette.textMuted,
                          fontFamily: "Inter_500Medium",
                        }}
                      >
                        {deliverable.quantity}x{" "}
                        {FORMAT_DISPLAY[deliverable.contentType] ?? deliverable.contentType}
                      </Text>
                    </View>
                    {deliverable.notes ? (
                      <Text
                        className="mt-1.5 text-xs"
                        style={{
                          color: palette.textMuted,
                          fontFamily: "Inter_400Regular",
                        }}
                      >
                        {deliverable.notes}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

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
        {selectedDeliverable && !isSubmitted && !isApproved && !isPublished ? (
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
        {selectedDeliverable && isApproved && latestSub ? (
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
          <View>
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

            <View
              className="rounded-2xl border px-4 py-4"
              style={{
                borderColor: palette.borderSubtle,
                backgroundColor: palette.surface,
              }}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text
                    className="text-sm"
                    style={{
                      color: palette.textPrimary,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  >
                    {t("room.performanceProof")}
                  </Text>
                  <Text
                    className="mt-1 text-xs leading-5"
                    style={{
                      color: palette.textMuted,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {performanceNeedsCorrection
                      ? t("room.performanceCorrectionRequested")
                      : latestPerformance
                        ? t("room.performanceSubmitted")
                        : t("room.performanceProofDetail")}
                  </Text>
                </View>
                {latestPerformance && !performanceNeedsCorrection ? (
                  <View
                    className="rounded-full px-3 py-1"
                    style={{ backgroundColor: palette.accentSoft }}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: palette.textTertiary,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {t("room.status.submitted")}
                    </Text>
                  </View>
                ) : null}
              </View>

              {performanceNeedsCorrection && openReportTask.reviewNote ? (
                <View
                  className="mt-4 rounded-xl border px-4 py-3"
                  style={{
                    borderColor: "#FCD34D",
                    backgroundColor: "#FFFBEB",
                  }}
                >
                  <View className="flex-row items-start gap-2">
                    <AlertCircle
                      size={16}
                      color="#B45309"
                      strokeWidth={1.8}
                    />
                    <View className="flex-1">
                      <Text
                        className="text-xs uppercase tracking-[1px]"
                        style={{
                          color: "#92400E",
                          fontFamily: "Inter_600SemiBold",
                        }}
                      >
                        {t("room.performanceCorrectionRequested")}
                      </Text>
                      <Text
                        className="mt-1.5 text-sm leading-5"
                        style={{
                          color: "#78350F",
                          fontFamily: "Inter_400Regular",
                        }}
                      >
                        {openReportTask.reviewNote}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {latestPerformance && !performanceNeedsCorrection ? (
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <MetricRead
                    label={t("room.metric.views")}
                    value={latestPerformance.views}
                    palette={palette}
                  />
                  <MetricRead
                    label={t("room.metric.likes")}
                    value={latestPerformance.likes}
                    palette={palette}
                  />
                  <MetricRead
                    label={t("room.metric.comments")}
                    value={latestPerformance.comments}
                    palette={palette}
                  />
                  <MetricRead
                    label={t("room.metric.shares")}
                    value={latestPerformance.shares}
                    palette={palette}
                  />
                </View>
              ) : (
                <>
                  <View className="mt-4 flex-row flex-wrap gap-2">
                    {(
                      [
                        ["views", t("room.metric.views")],
                        ["likes", t("room.metric.likes")],
                        ["comments", t("room.metric.comments")],
                        ["shares", t("room.metric.shares")],
                        ["saves", t("room.metric.saves")],
                      ] as const
                    ).map(([key, label]) => (
                      <View key={key} className="w-[31%] min-w-[92px] flex-1">
                        <Text
                          className="text-[11px]"
                          style={{
                            color: palette.textMuted,
                            fontFamily: "Inter_500Medium",
                          }}
                        >
                          {label}
                        </Text>
                        <TextInput
                          value={metricInputs[key]}
                          onChangeText={(value) =>
                            setMetricInputs({ ...metricInputs, [key]: value })
                          }
                          placeholder="0"
                          placeholderTextColor={palette.textMuted}
                          keyboardType="number-pad"
                          className="mt-1 rounded-xl border px-3 py-3 text-sm"
                          style={{
                            borderColor: palette.inputBorder,
                            backgroundColor: palette.background,
                            color: palette.textPrimary,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        />
                      </View>
                    ))}
                  </View>

                  <View className="mt-4">
                    <Pressable
                      onPress={onPickProofFile}
                      className="flex-row items-center gap-3 rounded-xl border px-4 py-3.5"
                      style={{
                        borderColor: proofFile
                          ? palette.textPrimary
                          : palette.inputBorder,
                        backgroundColor: palette.background,
                      }}
                    >
                      <Upload
                        size={18}
                        color={palette.textMuted}
                        strokeWidth={1.7}
                      />
                      <View className="flex-1">
                        <Text
                          className="text-sm"
                          style={{
                            color: palette.textPrimary,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        >
                          {proofFile
                            ? t("room.changeProofFile")
                            : t("room.attachProofFile")}
                        </Text>
                        <Text
                          className="mt-1 text-xs"
                          style={{
                            color: palette.textMuted,
                            fontFamily: "Inter_400Regular",
                          }}
                          numberOfLines={1}
                        >
                          {proofFile?.name ?? t("room.attachProofFileDetail")}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  <View className="mt-4">
                    <Text
                      className="mb-2 text-sm"
                      style={{
                        color: palette.textPrimary,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {t("room.proofUrlLabel")}
                    </Text>
                    <TextInput
                      value={proofUrl}
                      onChangeText={setProofUrl}
                      placeholder={t("room.proofUrlPlaceholder")}
                      placeholderTextColor={palette.textMuted}
                      autoCapitalize="none"
                      keyboardType="url"
                      className="rounded-xl border px-4 py-3.5"
                      style={{
                        borderColor: palette.inputBorder,
                        backgroundColor: palette.background,
                        color: palette.textPrimary,
                        fontFamily: "Inter_400Regular",
                        fontSize: 15,
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={() =>
                      onSubmitPerformance(latestSub.id, openReportTask?.id)
                    }
                    disabled={
                      submittingPerformance ||
                      !hasAtLeastOneMetric(metricInputs) ||
                      (!proofFile && !proofUrl.trim())
                    }
                    className="mt-4 items-center rounded-xl py-4"
                    style={{
                      backgroundColor: palette.buttonPrimaryBackground,
                      opacity:
                        submittingPerformance ||
                        !hasAtLeastOneMetric(metricInputs) ||
                        (!proofFile && !proofUrl.trim())
                          ? 0.5
                          : 1,
                    }}
                  >
                    {submittingPerformance ? (
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
                        {t("room.submitPerformance")}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
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

        {!selectedDeliverable ? (
          <View className="items-center py-8">
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
    </KeyboardAvoidingView>
  );
}
