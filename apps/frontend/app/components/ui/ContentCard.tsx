import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { Bookmark, Heart } from "lucide-react";
import { Tag } from "~/components/ui/Tag";
import { Avatar } from "~/components/ui/Avatar";
import type { ContentType } from "~/types/content";
import { CONTENT_TYPES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";

export interface ContentCardData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnailUrl?: string;
  contentType: ContentType;
  contentTypeLabel: string;
  locationTags: string[];
  author: {
    name: string;
    avatarUrl?: string | null;
    username: string;
  };
  date?: string;
  season?: string;
  likeCount?: number;
  saveCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

interface ContentCardProps {
  data: ContentCardData;
  onSaveToggle?: () => void;
  onLikeToggle?: () => void;
  showStats?: boolean;
  statsSection?: ReactNode;
  menuSection?: ReactNode;
}

const typeColorMap: Record<ContentType, string> = {
  [CONTENT_TYPES.BLOG]: "bg-primary/90 text-neutral",
  [CONTENT_TYPES.JOURNAL]: "bg-tertiary/90 text-neutral",
  [CONTENT_TYPES.TRAVEL_PLAN]: "bg-info/90 text-neutral",
};

export function ContentCard({
  data: initialData,
  onSaveToggle,
  onLikeToggle,
  showStats = false,
  statsSection,
  menuSection,
}: ContentCardProps) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const href = data.contentType === CONTENT_TYPES.BLOG
    ? ROUTES.BLOG.DETAIL(data.slug)
    : data.contentType === CONTENT_TYPES.JOURNAL
    ? ROUTES.JOURNAL.DETAIL(data.slug)
    : ROUTES.PLAN.DETAIL(data.slug);
  const isJournalOrder = data.contentTypeLabel.startsWith("#");
  const leftLabel = isJournalOrder ? "Blog" : data.contentTypeLabel;

  const handleLike = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setData((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
    }));
    onLikeToggle?.();
  };

  const handleSave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setData((prev) => ({
      ...prev,
      isSaved: !prev.isSaved,
    }));
    onSaveToggle?.();
  };

  return (
    <article className="group rounded-2xl bg-surface border border-border-custom transition-all duration-300 hover:shadow-lg hover:border-primary/20 animate-fade-in">
      {/* Thumbnail */}
      <Link to={href} className="block relative overflow-hidden rounded-t-2xl">
        <figure className="aspect-16/10 bg-border-custom overflow-hidden">
          {data.thumbnailUrl ? (
            <img
              src={data.thumbnailUrl}
              alt={data.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <span className="flex items-center justify-center w-full h-full text-on-surface-muted/30 text-headline-lg">
              📍
            </span>
          )}
        </figure>

        {/* Content type badge */}
        <span
          className={`absolute top-3 left-3 rounded-lg px-2.5 py-1 text-label-sm font-semibold backdrop-blur-sm ${typeColorMap[data.contentType]}`}
        >
          {leftLabel}
        </span>

        {/* Journal order badge overlayed at top right */}
        {isJournalOrder && (
          <span
            className="absolute top-3 right-3 rounded-lg px-2.5 py-1 text-label-sm font-bold bg-tertiary text-neutral shadow-lg border border-tertiary/20 backdrop-blur-sm"
          >
            {data.contentTypeLabel}
          </span>
        )}
      </Link>

      {/* Content */}
      <section className="p-5">
        {/* Location tags */}
        {data.locationTags.length > 0 && (
          <nav className="flex flex-wrap gap-1.5 mb-2" aria-label="Locations">
            {data.locationTags.slice(0, 3).map((loc) => (
              <Tag key={loc} label={loc} variant="location" size="sm" />
            ))}
            {data.locationTags.length > 3 && (
              <span className="text-label-sm text-on-surface-muted">+{data.locationTags.length - 3}</span>
            )}
          </nav>
        )}

        <Link to={href}>
          <h3 className="text-headline-md text-on-surface line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
            {data.title}
          </h3>
        </Link>

        <p className="text-body-sm text-on-surface-muted line-clamp-2 mb-4">
          {data.summary}
        </p>

        {/* Author + Meta */}
        <footer className="flex items-center justify-between">
          <Link
            to={ROUTES.USER.DETAIL(data.author.username)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <Avatar src={data.author.avatarUrl} alt={data.author.name} size="sm" />
            <span className="flex flex-col">
              <span className="text-label-md text-on-surface">{data.author.name}</span>
              {(data.date || data.season) && (
                <time className="text-label-sm text-on-surface-muted">
                  {data.date ?? data.season}
                </time>
              )}
            </span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Actions">
            {onLikeToggle && (
              <button
                type="button"
                onClick={handleLike}
                title={data.isLiked ? "Unlike" : "Like"}
                className={`p-2 rounded-lg transition-all active:scale-75 ${
                  data.isLiked ? "text-tertiary" : "text-on-surface-muted hover:text-tertiary"
                }`}
                aria-label={data.isLiked ? "Unlike" : "Like"}
              >
                <Heart size={18} fill={data.isLiked ? "currentColor" : "none"} />
              </button>
            )}
            {onSaveToggle && (
              <button
                type="button"
                onClick={handleSave}
                title={data.isSaved ? "Unsave" : "Save"}
                className={`p-2 rounded-lg transition-all active:scale-75 ${
                  data.isSaved ? "text-primary" : "text-on-surface-muted hover:text-primary"
                }`}
                aria-label={data.isSaved ? "Unsave" : "Save"}
              >
                <Bookmark size={18} fill={data.isSaved ? "currentColor" : "none"} />
              </button>
            )}
            {menuSection}
          </nav>
        </footer>

        {/* Stats section for Editor Studio */}
        {showStats && statsSection && (
          <section className="mt-4 pt-4 border-t border-border-custom">
            {statsSection}
          </section>
        )}
      </section>
    </article>
  );
}
