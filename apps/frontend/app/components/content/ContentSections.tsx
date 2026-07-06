import { Heart, MessageCircle, Eye, BookOpen, Bookmark } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";

interface SupportSectionProps {
  authorName?: string;
  donationUrl?: string;
}

export function SupportSection({ authorName, donationUrl }: SupportSectionProps) {
  return (
    <aside className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4">
      {donationUrl && authorName && (
        <section className="flex items-center justify-between">
          <p className="text-body-md text-on-surface">
            Want to buy <strong>{authorName}</strong> a coffee? ☕
          </p>
          <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="tertiary" size="sm">Support</Button>
          </a>
        </section>
      )}

      <section className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-muted">
          Want to support the team behind the NomadLogs project?
        </p>
        <a
          href="https://ko-fi.com/nomadlogs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Button variant="secondary" size="sm">Support NomadLogs ❤️</Button>
        </a>
      </section>
    </aside>
  );
}

interface ExploreOtherContentProps {
  title: string;
  children: React.ReactNode;
  viewAllHref?: string;
}

export function ExploreOtherContent({ title, children, viewAllHref }: ExploreOtherContentProps) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h3 className="text-headline-md text-on-surface">{title}</h3>
        {viewAllHref && (
          <Link to={viewAllHref} className="text-label-lg text-primary hover:text-secondary transition-colors">
            See More →
          </Link>
        )}
      </header>
      <nav className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2" aria-label={title}>
        {children}
      </nav>
    </section>
  );
}

interface ContentStatsBarProps {
  views: number;
  fullReads: number;
  likes: number;
  saves: number;
  comments: number;
}

export function ContentStatsBar({ views, fullReads, likes, saves, comments }: ContentStatsBarProps) {
  const stats = [
    { icon: <Eye size={14} />, value: views, label: "views" },
    { icon: <BookOpen size={14} />, value: fullReads, label: "reads" },
    { icon: <Heart size={14} />, value: likes, label: "likes" },
    { icon: <Bookmark size={14} />, value: saves, label: "saves" },
    { icon: <MessageCircle size={14} />, value: comments, label: "comments" },
  ];

  return (
    <ul className="flex items-center gap-4 flex-wrap">
      {stats.map((stat) => (
        <li
          key={stat.label}
          className="flex items-center gap-1.5 text-label-md text-on-surface-muted"
        >
          {stat.icon}
          <span>{stat.value}</span>
        </li>
      ))}
    </ul>
  );
}
