import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface RevisionRequestedProps {
  creatorName: string;
  campaignTitle: string;
  feedback: string;
  campaignUrl: string;
}

export function RevisionRequestedEmail({
  campaignTitle = "Campaign",
  feedback = "Please adjust the intro.",
  campaignUrl = "https://popsdrops.com",
}: RevisionRequestedProps) {
  return (
    <EmailLayout preview={`Changes requested for "${campaignTitle}"`}>
      <Text style={styles.heading}>Revision requested</Text>
      <Text style={styles.paragraph}>
        The brand has reviewed your content and requested some changes.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Feedback</Text>
        <Text style={{ ...styles.paragraph, margin: "4px 0 0 0" }}>
          {feedback}
        </Text>
      </Section>
      <Text style={styles.paragraph}>
        Please review the feedback and submit an updated version.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          View Feedback
        </Link>
      </Section>
    </EmailLayout>
  );
}
