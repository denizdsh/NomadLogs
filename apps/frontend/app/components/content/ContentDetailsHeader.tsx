import { Link } from "react-router";
import {
  Heart,
  Bookmark,
  UserPlus,
  UserCheck,
  Calendar,
  Clock,
} from "lucide-react";
import { Avatar } from "~/components/ui/Avatar";
import { Button } from "~/components/ui/Button";
import { Tag } from "~/components/ui/Tag";
import { Badge } from "~/components/ui/Badge";
import { VerificationBanner } from "~/components/content/VerificationBanner";
import { Tooltip } from "~/components/ui/Tooltip";
import { DropdownMenu } from "~/components/ui/DropdownMenu";

import type { UiVerificationStatus } from "~/types/content";
import { ROUTES } from "~/constants/routes";

export interface ContentDetailsHeaderProps {
  title: string;
  thumbnailUrl?: string;
  verificationStatus: UiVerificationStatus;
  locationTags?: string[];
  categoryTags?: string[];
  author: {
    name: string;
    avatarUrl?: string | null;
    username: string;
  };
  publishedAt?: string;
  updatedAt?: string;
  description?: string;
  likeCount?: number;
  saveCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  onLikeToggle?: () => void;
  onSaveToggle?: () => void;
  onFollowToggle?: () => void;
  // Specific view fields
  journalName?: string;
  journalSlug?: string;
  sequenceNumber?: number;
  dayCount?: number;
  season?: string;
  blogCount?: number;
  // Custom dropdown actions (Edit, Delete, Verify, etc.)
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
  }>;
}

export function ContentDetailsHeader({
  title,
  thumbnailUrl,
  verificationStatus,
  locationTags = [],
  categoryTags = [],
  author,
  publishedAt,
  updatedAt,
  description,
  likeCount = 0,
  saveCount = 0,
  isLiked = false,
  isSaved = false,
  isFollowing = false,
  onLikeToggle,
  onSaveToggle,
  onFollowToggle,
  journalName,
  journalSlug,
  sequenceNumber,
  dayCount,
  season,
  blogCount,
  actions,
}: ContentDetailsHeaderProps) {
  return (
    <section className="relative rounded-2xl bg-surface border border-border-custom overflow-hidden">
      {/* Dynamic thumbnail faint background image using Tailwind v4 dark: support */}
      {thumbnailUrl && (
        <div
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.04] pointer-events-none transition-all duration-300"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <VerificationBanner status={verificationStatus} />

      <section className="relative p-6 space-y-5">
        {/* Title & unique subtitle meta */}
        <header className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-headline-display text-on-surface mb-1">
              {title}
            </h1>
            {journalName && journalSlug && sequenceNumber !== undefined && (
              <p className="text-body-sm text-on-surface-muted">
                #{sequenceNumber} in{" "}
                <Link
                  to={ROUTES.JOURNAL.DETAIL(journalSlug)}
                  className="text-primary hover:underline"
                >
                  {journalName}
                </Link>
              </p>
            )}
            {dayCount !== undefined && (
              <p className="flex items-center text-center gap-2 text-body-md text-on-surface-muted mt-1">
                <span>{dayCount} days in</span>
                {season && (
                  <Badge label={season} variant="warning" className="italic" />
                )}
              </p>
            )}
            {blogCount !== undefined && (
              <p className="text-body-md text-on-surface-muted mt-1">
                {blogCount} blog posts
              </p>
            )}
          </div>
          {actions && actions.length > 0 && (
            <div className="flex-shrink-0">
              <DropdownMenu items={actions} />
            </div>
          )}
        </header>

        {/* Location tags */}
        {locationTags.length > 0 && (
          <nav className="flex flex-wrap gap-2" aria-label="Locations">
            {locationTags.map((loc) => (
              <Tag key={loc} label={loc} variant="location" size="sm" />
            ))}
          </nav>
        )}

        {/* Category tags */}
        {categoryTags.length > 0 && (
          <nav className="flex flex-wrap gap-2" aria-label="Categories">
            {categoryTags.map((cat) => (
              <Tag key={cat} label={cat} size="sm" />
            ))}
          </nav>
        )}

        {/* Author & Grouped Engagement Actions */}
        <section className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border-custom">
          <Link
            to={ROUTES.USER.DETAIL(author.username)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <Avatar src={author.avatarUrl} alt={author.name} size="md" />
            <span className="text-label-lg text-on-surface">{author.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Interactive, animated Like Button */}
            <Tooltip content={isLiked ? "Unlike" : "Like"}>
              <button
                type="button"
                onClick={onLikeToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all active:scale-[0.95] active:translate-y-[1px] ${
                  isLiked
                    ? "border-tertiary text-tertiary bg-tertiary/10"
                    : "border-border-custom text-on-surface-muted hover:border-tertiary hover:text-tertiary"
                }`}
                aria-label={isLiked ? "Unlike" : "Like"}
              >
                <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
                <span className="text-label-lg">{likeCount}</span>
              </button>
            </Tooltip>

            {/* Interactive, animated Save Button */}
            <Tooltip content={isSaved ? "Unsave" : "Save"}>
              <button
                type="button"
                onClick={onSaveToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all active:scale-[0.95] active:translate-y-[1px] ${
                  isSaved
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border-custom text-on-surface-muted hover:border-primary hover:text-primary"
                }`}
                aria-label={isSaved ? "Unsave" : "Save"}
              >
                <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                <span className="text-label-lg">{saveCount}</span>
              </button>
            </Tooltip>

            {/* Interactive, animated Follow Button */}
            <Button
              variant={isFollowing ? "secondary" : "primary"}
              size="sm"
              onClick={onFollowToggle}
              className="active:scale-[0.95] active:translate-y-[1px] transition-all"
            >
              {isFollowing ? (
                <>
                  <UserCheck size={14} />
                  Following
                </>
              ) : (
                <>
                  <UserPlus size={14} />
                  Follow
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Date stamps */}
        {(publishedAt || updatedAt) && (
          <section className="flex items-center gap-4 text-label-md text-on-surface-muted">
            {publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {publishedAt}
              </span>
            )}
            {updatedAt && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                Updated {updatedAt}
              </span>
            )}
          </section>
        )}

        {/* Short description */}
        {description && (
          <p className="text-body-lg text-on-surface-muted">{description}</p>
        )}
      </section>
    </section>
  );
}
