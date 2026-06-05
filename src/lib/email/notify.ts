import { sendEmail } from "./send";
import {
  EMAIL_NOTIFICATION_TYPES,
  buildNotificationEmail,
  isEmailNotificationType,
} from "./notification-email-builder";

export {
  EMAIL_NOTIFICATION_TYPES,
  buildNotificationEmail,
  isEmailNotificationType,
};

interface EmailNotification {
  type: string;
  recipientEmail: string;
  recipientName: string;
  data: Record<string, unknown>;
}

export type NotificationEmailDeliveryResult =
  | { status: "sent" }
  | { status: "unsupported" }
  | { status: "failed"; errorMessage: string };

/**
 * Send an email notification based on type.
 * Non-blocking - errors are logged, never thrown.
 */
export async function sendNotificationEmail({
  type,
  recipientEmail,
  recipientName,
  data,
}: EmailNotification): Promise<NotificationEmailDeliveryResult> {
  try {
    const email = buildNotificationEmail({ type, recipientName, data });
    if (!email) return { status: "unsupported" };

    await sendEmail({
      to: recipientEmail,
      ...email,
    });

    return { status: "sent" };
  } catch (error) {
    console.error(`Failed to send ${type} email to ${recipientEmail}:`, error);
    return {
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Unknown email error",
    };
  }
}
