export function meta() {
  return [
    { title: "Terms of Service — NomadLogs" },
    { name: "description", content: "NomadLogs terms of service and usage guidelines." },
  ];
}

export default function Terms() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 animate-fade-in">
      <header className="mb-10">
        <h1 className="text-headline-display text-on-surface mb-2">Terms of Service</h1>
        <p className="text-body-md text-on-surface-muted">Last updated: July 2026</p>
      </header>

      <section className="prose max-w-none space-y-8 [&_h2]:text-headline-md [&_h2]:text-on-surface [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-body-md [&_p]:text-on-surface/90 [&_p]:mb-3 [&_ul]:text-body-md [&_ul]:text-on-surface/90 [&_li]:mb-1.5">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using NomadLogs, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you should not use the platform.</p>

        <h2>2. User Accounts</h2>
        <p>You must authenticate via a supported OAuth provider (Google, Apple, GitHub, or Facebook). You are responsible for maintaining the security of your account.</p>

        <h2>3. Content Guidelines</h2>
        <p>You retain ownership of content you post. By publishing content on NomadLogs, you grant us a non-exclusive license to display, distribute, and promote your content within the platform.</p>
        <ul>
          <li>Content must be original or properly attributed</li>
          <li>No hate speech, harassment, or discriminatory content</li>
          <li>No misleading or fraudulent travel information</li>
          <li>Images must respect copyright and privacy</li>
        </ul>

        <h2>4. Content Moderation</h2>
        <p>Content from unverified users requires editorial approval before public visibility. Editors may request changes or reject content that violates guidelines. Users who receive two verified posts become automatically verified.</p>

        <h2>5. Privacy</h2>
        <p>Your use of NomadLogs is also governed by our Privacy Policy, which details how we collect, use, and protect your data.</p>

        <h2>6. Termination</h2>
        <p>We reserve the right to suspend or ban accounts that violate these terms. Users may delete their accounts at any time through the Settings page.</p>

        <h2>7. Disclaimer</h2>
        <p>NomadLogs is provided "as is" without warranties of any kind. Travel information shared by users is for informational purposes only. Always verify travel details independently.</p>

        <h2>8. Changes to Terms</h2>
        <p>We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
      </section>
    </article>
  );
}
