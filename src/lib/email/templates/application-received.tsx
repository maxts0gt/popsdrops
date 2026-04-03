import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface ApplicationReceivedProps {
  brandName: string;
  creatorName: string;
  campaignTitle: string;
  proposedRate: number;
  campaignUrl: string;
}

export function ApplicationReceivedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  proposedRate = 200,
  campaignUrl = "https://popsdrops.com",
}: ApplicationReceivedProps) {
  return (
    <EmailLayout preview={`New application: ${campaignTitle}`}>
      <Text style={styles.heading}>New application.</Text>
      <Text style={styles.paragraph}>
        {creatorName} has applied to your campaign at ${proposedRate}.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review application
        </Link>
      </Section>
    </EmailLayout>
  );
}
