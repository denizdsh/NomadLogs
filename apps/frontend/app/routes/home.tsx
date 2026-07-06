import { Link } from "react-router";
import { Compass, Newspaper, Map, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Tag } from "~/components/ui/Tag";
import { ContentCard, type ContentCardData } from "~/components/ui/ContentCard";
import { trpc } from "~/utils/trpc";
import { ROUTES } from "~/constants/routes";
import type { ContentType } from "~/types/content";
import { CONTENT_TYPES } from "~/constants/content";

export function meta() {
  return [
    { title: "NomadLogs — Decentralized Travel Community" },
    { name: "description", content: "Document your travels, plan itineraries, and follow other explorers." },
  ];
}

export default function Home() {
  // Fetch popular content
  const { data: popularData, isLoading: isPopularLoading } = trpc.explore.list.useQuery({
    sort: "popular",
    limit: 3,
  });

  // Fetch recent journals
  const { data: recentJournalsData, isLoading: isRecentLoading } = trpc.explore.list.useQuery({
    contentTypes: ["JOURNAL"],
    sort: "newest",
    limit: 3,
  });

  // Fetch category tags
  const { data: dbTags } = trpc.tag.listTags.useQuery({ limit: 12 });

  const mapBackendToCard = (item: any, type: ContentType): ContentCardData => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.description,
    thumbnailUrl: item.featuredImageUrl ?? undefined,
    contentType: type,
    contentTypeLabel: type === CONTENT_TYPES.BLOG ? "Blog" : type === CONTENT_TYPES.JOURNAL ? `Journal — ${item.blogCount} posts` : `Travel Plan — ${item.dayCount} days`,
    locationTags: item.locations?.map((l: any) => l.location.name) ?? [],
    author: {
      name: item.author.name,
      avatarUrl: item.author.avatarUrl,
      username: item.author.name.toLowerCase().replace(/\s+/g, ""),
    },
    date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : undefined,
    season: item.season ? String(item.season) : undefined,
  });

  const featuredList = (popularData ?? []).flatMap((res: any) =>
    res.items.map((item: any) => mapBackendToCard(item, res.contentType.toLowerCase()))
  );

  const journalsList = (recentJournalsData ?? []).flatMap((res: any) =>
    res.items.map((item: any) => mapBackendToCard(item, res.contentType.toLowerCase()))
  );

  return (
    <article className="animate-fade-in divide-y divide-border-custom">
      {/* Hero section */}
      <header className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-transparent py-24 text-center px-6">
        <section className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-headline-display text-on-surface">
            Document your journeys.<br />
            Share the open road.
          </h1>
          <p className="text-body-lg text-on-surface-muted max-w-xl mx-auto">
            NomadLogs is an organic, editor-verified community for keeping travel journals, planning structured itineraries, and sharing paths.
          </p>
          <nav className="flex items-center justify-center gap-4 pt-2">
            <Link to={ROUTES.EXPLORE}>
              <Button variant="primary" size="lg">
                Explore Travels
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to={ROUTES.STUDIO}>
              <Button variant="secondary" size="lg">
                Write a Story
              </Button>
            </Link>
          </nav>
        </section>
      </header>

      {/* Categories section */}
      {dbTags && dbTags.length > 0 && (
        <section className="py-16 px-6 bg-neutral/20">
          <section className="mx-auto max-w-7xl">
            <h2 className="text-headline-md text-on-surface mb-6 text-center">Popular Travel Categories</h2>
            <ul className="flex flex-wrap items-center justify-center gap-3 max-w-3xl mx-auto">
              {dbTags.map((tag) => (
                <li key={tag.id}>
                  <Link to={`${ROUTES.EXPLORE}?tagId=${tag.id}&tagName=${encodeURIComponent(tag.name)}`}>
                    <Tag label={tag.name} size="md" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </section>
      )}

      {/* Popular travels section */}
      <section className="py-20 px-6">
        <section className="mx-auto max-w-7xl">
          <header className="flex items-end justify-between mb-10">
            <section className="space-y-1">
              <h2 className="text-headline-lg text-on-surface">Featured Travels</h2>
              <p className="text-body-md text-on-surface-muted">Editor-approved stories and itineraries</p>
            </section>
            <Link to={`${ROUTES.EXPLORE}?sort=popular`} className="text-label-lg text-primary hover:underline flex items-center gap-1 font-semibold">
              View All <ArrowRight size={14} />
            </Link>
          </header>

          {isPopularLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 skeleton-shimmer">
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
            </div>
          ) : featuredList.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredList.map((item) => (
                <li key={item.id}>
                  <ContentCard data={item} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-on-surface-muted italic py-8">No featured content available yet.</div>
          )}
        </section>
      </section>

      {/* Recent journals section */}
      <section className="py-20 px-6 bg-neutral/10">
        <section className="mx-auto max-w-7xl">
          <header className="flex items-end justify-between mb-10">
            <section className="space-y-1">
              <h2 className="text-headline-lg text-on-surface">Recent Journal Collections</h2>
              <p className="text-body-md text-on-surface-muted">Multi-chapter stories of major travels</p>
            </section>
            <Link to={`${ROUTES.EXPLORE}?type=journals`} className="text-label-lg text-primary hover:underline flex items-center gap-1 font-semibold">
              View All <ArrowRight size={14} />
            </Link>
          </header>

          {isRecentLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 skeleton-shimmer">
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
              <div className="h-80 rounded-2xl bg-surface border border-border-custom" />
            </div>
          ) : journalsList.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {journalsList.map((item) => (
                <li key={item.id}>
                  <ContentCard data={item} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-on-surface-muted italic py-8">No recent journals available yet.</div>
          )}
        </section>
      </section>
    </article>
  );
}
