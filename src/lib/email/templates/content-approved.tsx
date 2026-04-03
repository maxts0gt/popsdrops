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
    <EmailLayout preview={`Approved: ${campaignTitle}`}>
      <Text style={styles.heading}>Your content has been approved.</Text>
      <Text style={styles.paragraph}>
        {creatorName}, the brand has approved your submission. You can now publish and submit performance data once live.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          View campaign
        </Link>
      </Section>
    </EmailLayout>
  );
}
