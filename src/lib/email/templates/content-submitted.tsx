import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface ContentSubmittedProps {
  brandName: string;
  creatorName: string;
  campaignTitle: string;
  platform: string;
  campaignUrl: string;
}

export function ContentSubmittedEmail({
  brandName = "Brand team",
  creatorName = "Creator",
  campaignTitle = "Campaign",
  platform = "TikTok",
  campaignUrl = "https://popsdrops.com",
}: ContentSubmittedProps) {
  return (
    <EmailLayout preview={`Content submitted: ${campaignTitle}`}>
      <Text style={styles.heading}>Content ready for review.</Text>
      <Text style={styles.paragraph}>
        {brandName}, {creatorName} submitted {platform} content. Review the
        work and approve it or request a specific correction.
      </Text>
      <EmailSummary
        items={[
          { label: "Campaign", value: campaignTitle },
          { label: "Creator", value: creatorName },
          { label: "Platform", value: platform },
          { label: "Next action", value: "Review content" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={campaignUrl} style={styles.button}>
          Review content
        </Link>
      </Section>
    </EmailLayout>
  );
}
