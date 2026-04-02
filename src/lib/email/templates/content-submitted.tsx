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
  brandName = "Brand",
  creatorName = "Creator",
  campaignTitle = "Campaign",
  platform = "TikTok",
  campaignUrl = "https://popsdrops.com",
}: ContentSubmittedProps) {
  return (
    <EmailLayout preview={`${creatorName} submitted content for "${campaignTitle}"`}>
      <Text style={styles.heading}>New content ready for review</Text>
      <Text style={styles.paragraph}>
        {creatorName} has submitted {platform} content for your campaign.
      </Text>
      <Section style={styles.card}>
        <Text style={styles.label}>Campaign</Text>
        <Text style={styles.value}>{campaignTitle}</Text>
      </Section>
      <Text style={styles.paragraph}>
        Review their submission and approve it or request changes.
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={campaignUrl} style={styles.button}>
          Review Content
        </Link>
      </Section>
    </EmailLayout>
  );
}
