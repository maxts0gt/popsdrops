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
    <EmailLayout preview={`Accepted: ${campaignTitle}`}>
      <Text style={styles.heading}>You have been selected.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, your application has been accepted. Review the brief and begin creating.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Agreed rate</Text>
        <Text style={styles.value}>${acceptedRate}</Text>
      </Section>
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Open campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
