import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

interface ContentSubmittedProps {
  brandName: string;
  creatorName: string;
  campaignTitle: string;
  platform: string;
  campaignUrl: string;
}

export function ContentSubmittedEmail({
  creatorName = "Creator",
  campaignTitle = "Campaign",
  platform = "TikTok",
  campaignUrl = "https://popsdrops.com",
}: ContentSubmittedProps) {
  return (
    <EmailLayout preview={`Content submitted: ${campaignTitle}`}>
      <Text style={styles.heading}>Content ready for review.</Text>
      <Text style={styles.paragraph}>
        {creatorName} has submitted {platform} content for review.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Text style={styles.paragraph}>
        Review the submission and approve or request changes.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "28px 0 8px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review content
        </Link>
      </Section>
    </EmailLayout>
  );
}
