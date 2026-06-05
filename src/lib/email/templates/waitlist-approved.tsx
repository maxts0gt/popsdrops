import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, EmailSummary, styles } from "./layout";

interface WaitlistApprovedProps {
  name: string;
  role: "brand" | "creator";
  loginUrl: string;
}

export function WaitlistApprovedEmail({
  name = "User",
  role = "brand",
  loginUrl = "https://popsdrops.com/login",
}: WaitlistApprovedProps) {
  return (
    <EmailLayout preview="Your PopsDrops account has been approved">
      <Text style={styles.heading}>Your account is ready.</Text>
      <Text style={styles.paragraph}>
        {name}, you have been approved.{" "}
        {role === "brand"
          ? "You can now create private campaign workspaces, invite creators, and manage cross-border work in one place."
          : "Complete your profile so PopsDrops can consider you for curated campaign briefs that match your audience."}
      </Text>
      <EmailSummary
        items={[
          {
            label: role === "brand" ? "Workspace" : "Creator profile",
            value: role === "brand" ? "Brand dashboard" : "Creator network",
          },
          { label: "Next action", value: "Sign in to PopsDrops" },
        ]}
      />
      <Section style={styles.ctaSection}>
        <Link href={loginUrl} style={styles.button}>
          Sign in to PopsDrops
        </Link>
      </Section>
    </EmailLayout>
  );
}
