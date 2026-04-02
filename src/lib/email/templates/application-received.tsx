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
    <EmailLayout preview={`New application for "${campaignTitle}"`}>
      <Text style={styles.heading}>New creator application</Text>
      <Text style={styles.paragraph}>
        {creatorName} has applied to your campaign.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={styles.card}>
        <Text style={styles.label}>Proposed Rate</Text>
        <Text style={styles.value}>${proposedRate}</Text>
      </Section>
      <Text style={styles.paragraph}>
        Review their profile and application to accept, counter-offer, or decline.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review Application
        </Link>
      </Section>
    </EmailLayout>
  );
}
