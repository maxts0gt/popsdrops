import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface RevisionRequestedProps {
  creatorName: string;
  campaignTitle: string;
  feedback: string;
  campaignUrl: string;
}

export function RevisionRequestedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  feedback = "Please adjust the intro.",
  campaignUrl = "https://popsdrops.com",
}: RevisionRequestedProps) {
  return (
    <EmailLayout preview={`Changes requested: ${campaignTitle}`}>
      <Text style={styles.heading}>Changes requested.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, the brand reviewed your submission and requested a
        specific update.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Feedback", value: feedback, multiline: true },
          { label: "Next action", value: "View feedback" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          View feedback
        </Link>
      </Section>
    </EmailLayout>
  );
}
