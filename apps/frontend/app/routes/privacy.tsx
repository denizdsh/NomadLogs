export function meta() {
  return [
    { title: "Privacy Policy — NomadLogs" },
    { name: "description", content: "NomadLogs privacy policy — how we handle your data." },
  ];
}

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 animate-fade-in">
      <header className="mb-10">
        <h1 className="text-headline-display text-on-surface mb-2">Privacy Policy</h1>
        <p className="text-body-md text-on-surface-muted">Last updated: July 2026</p>
      </header>

      <section className="prose max-w-none space-y-8 [&_h2]:text-headline-md [&_h2]:text-on-surface [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-body-md [&_p]:text-on-surface/90 [&_p]:mb-3 [&_ul]:text-body-md [&_ul]:text-on-surface/90 [&_li]:mb-1.5">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide through OAuth authentication (name, email, profile picture) and content you create on the platform (blogs, journals, travel plans, comments).</p>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain the NomadLogs platform</li>
          <li>To personalize your experience (location-based recommendations)</li>
          <li>To send notifications about your content and interactions</li>
          <li>To improve the platform and develop new features</li>
        </ul>

        <h2>3. Data Storage</h2>
        <p>Your data is stored securely. Images are stored on Cloudflare R2. We use industry-standard encryption and security practices.</p>

        <h2>4. Data Sharing</h2>
        <p>We do not sell your personal data. Content you publish publicly is visible to all users. Private content is only visible to you. Unlisted content is visible to anyone with the direct link.</p>

        <h2>5. Cookies</h2>
        <p>We use essential cookies for authentication and session management. We use preference cookies to remember your theme choice (light/dark mode).</p>

        <h2>6. Data Retention</h2>
        <ul>
          <li>Read notifications are deleted after 1 week</li>
          <li>Unread notifications are deleted after 1 month</li>
          <li>Inactive pending content chats are deleted after 30 days</li>
          <li>Account data is deleted permanently when you delete your profile</li>
        </ul>

        <h2>7. Your Rights</h2>
        <p>You have the right to access, modify, and delete your personal data. You can delete your entire profile and all associated content through the Settings page.</p>

        <h2>8. Contact</h2>
        <p>For privacy-related inquiries, contact us at privacy@nomadlogs.com.</p>
      </section>
    </article>
  );
}
