import type { ContentCardData } from "~/components/ui/ContentCard";
import type { ContentType } from "~/types/content";
import { CONTENT_TYPES, DB_VERIFICATION_STATUSES } from "~/constants/content";

/**
 * Standard utility to map backend content objects to ContentCardData structure.
 * Fixes the username routing bug by using the exact author name.
 */
export function mapBackendToCard(
  item: any,
  type: ContentType,
  profileOverride?: { name: string; avatarUrl?: string | null }
): ContentCardData {
  if (!item) {
    throw new Error("Item to map cannot be null or undefined");
  }

  const authorName = profileOverride?.name ?? item.author?.name ?? "";
  const authorAvatar = profileOverride?.avatarUrl ?? item.author?.avatarUrl ?? null;
  
  let contentTypeLabel = "";
  if (type === CONTENT_TYPES.BLOG) {
    contentTypeLabel = "Blog";
  } else if (type === CONTENT_TYPES.JOURNAL) {
    contentTypeLabel = item.blogCount !== undefined ? `Journal — ${item.blogCount} posts` : "Journal";
  } else if (type === CONTENT_TYPES.TRAVEL_PLAN) {
    contentTypeLabel = item.dayCount !== undefined ? `Travel Plan — ${item.dayCount} days` : "Travel Plan";
  }

  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.description || "",
    thumbnailUrl: item.featuredImageUrl ?? undefined,
    contentType: type,
    contentTypeLabel,
    locationTags: item.locations?.map((l: any) => l.location.name) ?? [],
    author: {
      name: authorName,
      avatarUrl: authorAvatar,
      username: authorName, // Use exact name for correct routing lookup
    },
    date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : undefined,
    season: item.season ? String(item.season) : undefined,
  };
}

export interface CommentAuthor {
  name: string;
  avatarUrl?: string | null;
  username: string;
}

export interface ClientComment {
  id: string;
  content: string;
  author: CommentAuthor;
  createdAt: string;
  isDeleted: boolean;
  isVerified: boolean;
  isOwnComment: boolean;
  replies: ClientComment[];
}

/**
 * Standard utility to map backend comment objects to client Comment structures.
 */
export function mapComment(c: any, currentUserId?: string): ClientComment {
  return {
    id: c.id,
    content: c.status === "DELETED" ? "[Deleted]" : c.body,
    author: {
      name: c.author.name,
      avatarUrl: c.author.avatarUrl,
      username: c.author.name, // Use exact name for correct routing lookup
    },
    createdAt: new Date(c.createdAt).toLocaleDateString(),
    isDeleted: c.status === "DELETED",
    isVerified: c.status === DB_VERIFICATION_STATUSES.VERIFIED,
    isOwnComment: c.author.id === currentUserId,
    replies: c.replies?.map((reply: any) => mapComment(reply, currentUserId)) ?? [],
  };
}

