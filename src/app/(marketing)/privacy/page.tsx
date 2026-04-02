import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="bg-white pt-28 pb-20 sm:pt-36">
      <article className="prose prose-slate mx-auto max-w-3xl px-6 prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h3:text-base">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-slate-500">Last updated: March 29, 2026</p>

        <p>
          Tengri Vertex, LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
          operates the PopsDrops platform (&quot;Service&quot;). This Privacy Policy describes how we
          collect, use, disclose, and protect your personal information when you use the Service.
        </p>
        <p>
          We are a Delaware limited liability company with our principal office in San Francisco,
          California.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>Information you provide</h3>
        <ul>
          <li><strong>Account information:</strong> Name, email address, and profile photo (via Google OAuth or email signup)</li>
          <li><strong>Profile information:</strong> Bio, primary market, languages spoken, niches, and profile photo (creators); company name, industry, website, target markets, and description (brands)</li>
          <li><strong>Social media accounts:</strong> Platform handles and publicly available metrics (follower counts, engagement rates) for TikTok, Instagram, Snapchat, YouTube, and Facebook</li>
          <li><strong>Campaign data:</strong> Campaign briefs, content submissions, reviews, ratings, messages, and application details</li>
          <li><strong>Rate card:</strong> Per-platform, per-format pricing set by creators</li>
          <li><strong>Communications:</strong> Messages sent through the platform and support requests</li>
        </ul>

        <h3>Information collected automatically</h3>
        <ul>
          <li><strong>Usage data:</strong> Pages visited, features used, actions taken, timestamps, and session duration</li>
          <li><strong>Device information:</strong> Browser type, operating system, and device type</li>
          <li><strong>Network information:</strong> IP address and approximate location (country/region level)</li>
          <li><strong>Language preferences:</strong> Browser language settings (used to deliver the platform in your preferred language)</li>
        </ul>

        <h3>Information we generate</h3>
        <ul>
          <li><strong>Performance metrics:</strong> Calculated engagement rates, response times, completion rates, and platform-specific performance scores</li>
          <li><strong>AI-generated translations:</strong> Translations of campaign briefs and platform content into your preferred language</li>
          <li><strong>Embeddings:</strong> Mathematical representations of profiles and campaigns used for creator-campaign matching (not human-readable)</li>
          <li><strong>Creator tier:</strong> Classification (New, Rising, Established, Top) based on campaign history and ratings</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li><strong>Provide the Service:</strong> Authenticate your identity, display your profile, match creators with campaigns, facilitate content review, and deliver translations</li>
          <li><strong>Communications:</strong> Send transactional emails (campaign updates, application status, content approvals) via AWS SES</li>
          <li><strong>Improvement:</strong> Analyze usage patterns to improve features, fix issues, and develop new functionality</li>
          <li><strong>Safety:</strong> Detect fraud, enforce our Terms of Service, and protect the security of the platform and its users</li>
          <li><strong>Legal compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
        </ul>
        <p>
          We do not use your information for targeted advertising. We do not sell your personal information.
        </p>

        <h2>3. How We Share Your Information</h2>

        <h3>With other users</h3>
        <p>
          Certain information is visible to other users as part of the Service&apos;s core functionality:
        </p>
        <ul>
          <li>Creator profiles (name, bio, social accounts, rates, niches, markets, ratings, and performance metrics) are visible to brands</li>
          <li>Brand profiles (company name, industry, and ratings) are visible to creators</li>
          <li>Campaign briefs are visible to creators who apply or are invited</li>
          <li>Reviews and ratings are visible to all users</li>
        </ul>

        <h3>With service providers</h3>
        <p>We share information with third-party service providers that help us operate the Service:</p>
        <ul>
          <li><strong>Supabase</strong> (database, authentication, storage) — stores your account data, campaign data, and files</li>
          <li><strong>Vercel</strong> (hosting, analytics) — hosts the application and collects anonymous usage analytics</li>
          <li><strong>Amazon Web Services (AWS SES)</strong> (email delivery) — processes transactional emails (receives your email address and message content)</li>
          <li><strong>Google Gemini API</strong> (AI translation) — processes text for translation (campaign briefs and UI strings, no personal identifiers sent)</li>
          <li><strong>Cohere</strong> (AI embeddings) — generates mathematical representations of profiles for matching (profile text sent, no direct identifiers)</li>
          <li><strong>Cloudflare</strong> (DNS, bot protection) — processes network requests and provides Turnstile bot verification on public forms</li>
          <li><strong>Upstash</strong> (rate limiting) — processes request metadata to prevent abuse</li>
        </ul>
        <p>
          These providers are contractually obligated to use your information only to provide services
          to us and are bound by their own privacy policies.
        </p>

        <h3>For legal reasons</h3>
        <p>
          We may disclose your information if required by law, subpoena, court order, or government
          request, or if we believe disclosure is necessary to protect our rights, your safety, or the
          safety of others.
        </p>

        <h3>Business transfers</h3>
        <p>
          If Tengri Vertex, LLC is involved in a merger, acquisition, or sale of assets, your information
          may be transferred as part of that transaction. We will notify you of any such change.
        </p>

        <h2>4. Cookies and Tracking</h2>
        <p>We use minimal cookies:</p>
        <ul>
          <li><strong>Authentication cookies:</strong> Essential cookies set by Supabase Auth to maintain your login session. These are strictly necessary and cannot be disabled.</li>
          <li><strong>Language preference:</strong> A cookie storing your selected language so the platform displays in your preferred language across visits.</li>
          <li><strong>Analytics:</strong> Vercel Analytics collects anonymous, aggregated usage data (page views, performance metrics). No personally identifiable information is collected by analytics.</li>
        </ul>
        <p>
          We do not use advertising cookies, social media tracking pixels, or third-party behavioral
          tracking. You can control cookies through your browser settings, though disabling essential
          cookies will prevent you from using the Service.
        </p>

        <h2>5. Data Retention</h2>
        <ul>
          <li><strong>Active accounts:</strong> We retain your information for as long as your account is active.</li>
          <li><strong>Deleted accounts:</strong> When you delete your account, we delete or anonymize your personal information within 30 days. Backups containing your data are purged within 90 days.</li>
          <li><strong>Campaign records:</strong> Anonymized campaign performance data may be retained indefinitely for benchmarking and analytics purposes.</li>
          <li><strong>Legal obligations:</strong> We may retain certain information longer if required by law (such as tax or financial records) or to resolve disputes.</li>
        </ul>

        <h2>6. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your information, including:
        </p>
        <ul>
          <li>Encryption in transit (TLS/SSL) and at rest</li>
          <li>Row-level security policies on our database</li>
          <li>Authentication via OAuth 2.0 and secure magic links (no passwords stored)</li>
          <li>Rate limiting and bot protection on public endpoints</li>
          <li>Server-side validation of all inputs</li>
          <li>File upload validation via magic bytes</li>
        </ul>
        <p>
          No system is perfectly secure. While we take reasonable measures to protect your data, we
          cannot guarantee absolute security. We will notify affected users of any data breach as
          required by applicable law.
        </p>

        <h2>7. Your Rights</h2>
        <p>
          Depending on your location, you may have the following rights regarding your personal information:
        </p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate information</li>
          <li><strong>Deletion:</strong> Request deletion of your personal information</li>
          <li><strong>Portability:</strong> Request a machine-readable copy of your data</li>
          <li><strong>Objection:</strong> Object to certain processing of your information</li>
          <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw that consent at any time</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at legal@popsdrops.com. We will respond within
          30 days. We may need to verify your identity before processing your request.
        </p>

        <h3>California residents (CCPA/CPRA)</h3>
        <p>
          If you are a California resident, you have the right to know what personal information we
          collect, request its deletion, and opt out of the sale of personal information. We do not
          sell personal information. You may designate an authorized agent to make requests on your
          behalf. We will not discriminate against you for exercising your privacy rights.
        </p>

        <h3>European Economic Area, UK, and Switzerland (GDPR)</h3>
        <p>
          If you are located in the EEA, UK, or Switzerland, our legal bases for processing your
          personal information are: (a) performance of a contract (providing the Service), (b) legitimate
          interests (improving the Service, preventing fraud), and (c) consent (where applicable, such
          as for optional communications). You have the right to lodge a complaint with your local data
          protection authority.
        </p>

        <h2>8. International Data Transfers</h2>
        <p>
          We are based in the United States. If you access the Service from outside the United States,
          your information will be transferred to, stored, and processed in the United States and
          potentially other countries where our service providers operate. By using the Service, you
          consent to such transfers. We implement appropriate safeguards for international data transfers
          as required by applicable law.
        </p>

        <h2>9. Children</h2>
        <p>
          The Service is not directed to individuals under 18 years of age. We do not knowingly collect
          personal information from anyone under 18. If we learn that we have collected information from
          a person under 18, we will delete it promptly. If you believe a minor has provided us with
          personal information, contact us at legal@popsdrops.com.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we will
          notify you by email or through the Service at least 30 days before the changes take effect.
          The &quot;Last updated&quot; date at the top reflects the most recent revision.
        </p>

        <h2>11. Contact</h2>
        <p>
          For questions, concerns, or requests regarding this Privacy Policy or your personal data,
          contact us at:<br />
          legal@popsdrops.com
        </p>
      </article>
    </div>
  );
}
