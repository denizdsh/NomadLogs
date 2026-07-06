/**
 * Query filter helper builders for Prisma queries.
 */

export function buildTagFilter(tagIds?: string[]) {
  return tagIds?.length ? { tags: { some: { tagId: { in: tagIds } } } } : {};
}

export function buildLocationFilter(locationIds?: string[]) {
  return locationIds?.length
    ? { locations: { some: { locationId: { in: locationIds } } } }
    : {};
}
