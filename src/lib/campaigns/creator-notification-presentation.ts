type NotificationData = Record<string, unknown> | null | undefined;

export type CreatorNotificationIconKey =
  | "announcement"
  | "approval"
  | "deadline"
  | "payment"
  | "profile"
  | "review"
  | "task";

export type CreatorNotificationTone =
  | "danger"
  | "neutral"
  | "success"
  | "warning";

export type CreatorNotificationPresentation = {
  iconKey: CreatorNotificationIconKey;
  tone: CreatorNotificationTone;
};

function getPaymentStatus(data: NotificationData): string | null {
  const paymentStatus = data?.payment_status;
  return typeof paymentStatus === "string" && paymentStatus.length > 0
    ? paymentStatus
    : null;
}

function isPaymentStatusNotification(type: string, data: NotificationData) {
  return (
    type === "payment_received" ||
    type === "payment_sent" ||
    type === "payment" ||
    (type === "campaign_update" && getPaymentStatus(data) !== null)
  );
}

export function getCreatorNotificationPresentation({
  type,
  data,
}: {
  type: string;
  data: NotificationData;
}): CreatorNotificationPresentation {
  if (isPaymentStatusNotification(type, data)) {
    return {
      iconKey: "payment",
      tone: getPaymentStatus(data) === "overdue" ? "warning" : "success",
    };
  }

  switch (type) {
    case "application_accepted":
    case "content_approved":
    case "account_approved":
    case "account_restored":
      return { iconKey: "approval", tone: "success" };
    case "application_rejected":
    case "account_suspended":
      return { iconKey: "approval", tone: "danger" };
    case "revision_requested":
    case "report_correction_requested":
    case "report_follow_up_requested":
      return { iconKey: "task", tone: "warning" };
    case "content_due_soon":
    case "deadline":
      return { iconKey: "deadline", tone: "danger" };
    case "review":
    case "review_received":
      return { iconKey: "review", tone: "warning" };
    case "tier_upgrade":
      return { iconKey: "profile", tone: "neutral" };
    case "campaign_update":
    default:
      return { iconKey: "announcement", tone: "neutral" };
  }
}

export function isCreatorPaymentStatusNotification(
  type: string,
  data: NotificationData,
) {
  return isPaymentStatusNotification(type, data);
}
