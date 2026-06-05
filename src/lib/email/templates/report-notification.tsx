import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface ReportNotificationEmailProps {
  preview: string;
  heading: string;
  message: string;
  campaignTitle: string;
  contextLabel?: string;
  actionLabel: string;
  actionUrl: string;
}

export function ReportNotificationEmail({
  preview = "Report update",
  heading = "Report update.",
  message = "There is a report update for your campaign.",
  campaignTitle = "Campaign",
  contextLabel = "Campaign",
  actionLabel = "Open campaign",
  actionUrl = "https://popsdrops.com",
}: ReportNotificationEmailProps) {
  return (
    <EmailLayout preview={preview}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.paragraph}>{message}</Text>
      <EmailSummary
        items={[
          { label: contextLabel, value: campaignTitle },
          { label: "Next action", value: actionLabel },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={actionUrl} style={styles.button}>
          {actionLabel}
        </Link>
      </Section>
    </EmailLayout>
  );
}
