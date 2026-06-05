import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DollarSign,
  Clock,
  CircleCheck,
  AlertCircle,
  Wallet,
} from "lucide-react-native";
import { useAuth } from "../../lib/auth";
import {
  loadEarnings,
  type EarningRecord,
  type EarningsSummary,
} from "../../lib/earnings";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/theme-context";

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { icon: typeof Clock; color: string; bg: string; labelKey: string }
> = {
  pending: {
    icon: Clock,
    color: "#B45309",
    bg: "#FFFBEB",
    labelKey: "earnings.status.pending",
  },
  invoiced: {
    icon: AlertCircle,
    color: "#0369A1",
    bg: "#F0F9FF",
    labelKey: "earnings.status.invoiced",
  },
  paid: {
    icon: CircleCheck,
    color: "#047857",
    bg: "#ECFDF5",
    labelKey: "earnings.status.paid",
  },
  overdue: {
    icon: AlertCircle,
    color: "#BE123C",
    bg: "#FFF1F2",
    labelKey: "earnings.status.overdue",
  },
  failed: {
    icon: AlertCircle,
    color: "#475569",
    bg: "#F1F5F9",
    labelKey: "earnings.status.failed",
  },
  refunded: {
    icon: AlertCircle,
    color: "#475569",
    bg: "#F1F5F9",
    labelKey: "earnings.status.refunded",
  },
  disputed: {
    icon: AlertCircle,
    color: "#BE123C",
    bg: "#FFF1F2",
    labelKey: "earnings.status.disputed",
  },
};

function getPaymentStatusMeta(status: string) {
  return PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.pending;
}

export default function EarningsScreen() {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const { palette } = useTheme();
  const userId = session?.user?.id ?? null;
  const [data, setData] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const earnings = await loadEarnings(userId);
      setData(earnings);
    } catch {
      // Silent fail - empty state shown
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

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const formatAcceptedDate = (date: string | null) => {
    if (!date) return "";

    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  return (
    <SafeAreaView
      className="flex-1"
      edges={["top"]}
      style={{ backgroundColor: palette.background }}
    >
      <View className="px-6 pt-6 pb-2">
        <Text
          className="text-[28px] tracking-tight"
          style={{ color: palette.textPrimary, fontFamily: "Inter_700Bold" }}
        >
          {t("earnings.title")}
        </Text>
        <Text
          className="mt-1 text-sm"
          style={{ color: palette.textMuted, fontFamily: "Inter_400Regular" }}
        >
          {t("earnings.trackingOnly")}
        </Text>
      </View>

      <FlatList<EarningRecord>
        testID="creator-earnings-ledger"
        data={data?.campaigns ?? []}
        keyExtractor={(item) => item.campaignId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
        ListHeaderComponent={
          data ? (
            <View className="mb-6">
              <View className="flex-row gap-3">
                <SummaryCard
                  icon={DollarSign}
                  label={t("earnings.paid")}
                  value={fmt(data.paidTotal)}
                  palette={palette}
                />
                <SummaryCard
                  icon={Clock}
                  label={t("earnings.open")}
                  value={fmt(data.openTotal)}
                  palette={palette}
                />
                <SummaryCard
                  icon={Wallet}
                  label={t("earnings.tracked")}
                  value={fmt(data.trackedTotal)}
                  palette={palette}
                />
              </View>

              {data.campaigns.length > 0 ? (
                <Text
                  className="mt-6 text-[11px] uppercase tracking-[1.4px]"
                  style={{
                    color: palette.textMuted,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {t("earnings.campaignLedger")}
                </Text>
              ) : null}
            </View>
          ) : loading ? (
            <View className="py-4">
              {[0, 1].map((i) => (
                <View
                  key={i}
                  className="mb-3 h-24 rounded-2xl"
                  style={{ backgroundColor: palette.skeleton }}
                />
              ))}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const config = getPaymentStatusMeta(item.paymentStatus);
          const StatusIcon = config.icon;

          return (
            <View
              testID="creator-earnings-row"
              className="mb-3 rounded-xl border px-4 py-4"
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
                    {item.campaignTitle}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{
                      color: palette.textMuted,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {item.brandName}
                    {item.joinedAt
                      ? ` | ${t("earnings.accepted")} ${formatAcceptedDate(item.joinedAt)}`
                      : ""}
                  </Text>
                </View>
                <Text
                  className="text-base"
                  style={{
                    color: palette.textPrimary,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {fmt(item.acceptedRate)}
                </Text>
              </View>
              <View className="mt-3 flex-row items-center gap-1.5">
                <View
                  className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ backgroundColor: config.bg }}
                >
                  <StatusIcon size={12} color={config.color} strokeWidth={2} />
                  <Text
                    className="text-[11px]"
                    style={{
                      color: config.color,
                      fontFamily: "Inter_600SemiBold",
                    }}
                  >
                    {t(config.labelKey)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View className="flex-1 items-center justify-center">
              <DollarSign
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
                {t("earnings.empty")}
              </Text>
              <Text
                className="mt-1.5 text-center text-sm"
                style={{
                  color: palette.textMuted,
                  fontFamily: "Inter_400Regular",
                }}
              >
                {t("earnings.emptyDetail")}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  palette,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  palette: ReturnType<typeof useTheme>["palette"];
}) {
  return (
    <View
      className="flex-1 rounded-2xl px-4 py-4"
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      }}
    >
      <Icon size={16} color={palette.textMuted} strokeWidth={1.6} />
      <Text
        className="mt-3 text-[20px]"
        style={{
          color: palette.textPrimary,
          fontFamily: "Inter_700Bold",
        }}
      >
        {value}
      </Text>
      <Text
        className="mt-1 text-[11px] uppercase tracking-[1.2px]"
        style={{
          color: palette.textMuted,
          fontFamily: "Inter_500Medium",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
