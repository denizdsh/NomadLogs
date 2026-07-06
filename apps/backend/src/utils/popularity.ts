/**
 * Popularity calculation utility.
 *
 * Formula from APP-SPECIFICATIONS.md:
 * Popularity = (1 × Views) + (2 × Full Reads) + (6 × Likes) + (12 × Saves) + (24 × Verified comments)
 */

export const POPULARITY_MULTIPLIERS = {
  view: 1,
  fullRead: 2,
  like: 6,
  save: 12,
  comment: 24,
} as const;

export function calculatePopularity(stats: {
  viewCount: number;
  fullReadCount: number;
  likeCount: number;
  saveCount: number;
  commentCount: number;
}): number {
  return (
    POPULARITY_MULTIPLIERS.view * stats.viewCount +
    POPULARITY_MULTIPLIERS.fullRead * stats.fullReadCount +
    POPULARITY_MULTIPLIERS.like * stats.likeCount +
    POPULARITY_MULTIPLIERS.save * stats.saveCount +
    POPULARITY_MULTIPLIERS.comment * stats.commentCount
  );
}