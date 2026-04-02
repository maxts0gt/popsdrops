import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface ContentApprovedProps {
  creatorName: string;
  campaignTitle: string;
  campaignUrl: string;
}

export function ContentApprovedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  campaignUrl = "https://popsdrops.com",
}: ContentApprovedProps) {
  return (
    <EmailLayout preview={`Your content for "${campaignTitle}" has been approved`}>
      <Text style={styles.heading}>Content approved</Text>
      <Text style={styles.paragraph}>
        Great news, {creatorName}. Your content for this campaign has been approved by the brand.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Text style={styles.paragraph}>
        You can now publish it on the platform and submit your performance data once live.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          View Campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
