import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface ApplicationAcceptedProps {
  creatorName: string;
  campaignTitle: string;
  acceptedRate: number;
  campaignUrl: string;
}

export function ApplicationAcceptedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  acceptedRate = 200,
  campaignUrl = "https://popsdrops.com",
}: ApplicationAcceptedProps) {
  return (
    <EmailLayout preview={`Accepted: ${campaignTitle}`}>
      <Text style={styles.heading}>You have been selected.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, your application has been accepted. Review the brief
        before you begin creating.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Agreed rate", value: `$${acceptedRate}` },
          { label: "Next action", value: "Open campaign" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          Open campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
