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
    <EmailLayout preview={`Changes requested: ${campaignTitle}`}>
      <Text style={styles.heading}>Changes requested.</Text>
      <Text style={styles.paragraph}>
        The brand has reviewed your submission and provided feedback.
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
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          View feedback
        </Link>
      </Section>
    </EmailLayout>
  );
}
