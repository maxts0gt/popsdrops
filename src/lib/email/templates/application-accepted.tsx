import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

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
    <EmailLayout preview={`You've been accepted to "${campaignTitle}"`}>
      <Text style={styles.heading}>You're in</Text>
      <Text style={styles.paragraph}>
        Congratulations, {creatorName}. You've been accepted to this campaign.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Agreed Rate</Text>
        <Text style={styles.value}>${acceptedRate}</Text>
      </Section>
      <Text style={styles.paragraph}>
        Head to your campaign room to review the brief and start creating.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Go to Campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
