import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

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
      <Text style={styles.heading}>Welcome to PopsDrops</Text>
      <Text style={styles.paragraph}>
        {name}, your {role === "brand" ? "brand" : "creator"} account has been approved. You&apos;re ready to get started.
      </Text>
      <Text style={styles.paragraph}>
        {role === "brand"
          ? "Create your first campaign and start connecting with vetted creators across global markets."
          : "Browse available campaigns, set up your profile, and start applying to opportunities."}
      </Text>
      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <Link href={loginUrl} style={styles.button}>
          Sign In
        </Link>
      </Section>
    </EmailLayout>
  );
}
