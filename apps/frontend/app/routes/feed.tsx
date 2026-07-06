import { Suspense, lazy } from "react";
import { Link } from "react-router";
import { Users } from "lucide-react";
import { trpc } from "~/utils/trpc";
import { useAuth } from "~/providers/AuthProvider";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { EmptyState } from "~/components/ui/EmptyState";
import { ContentCard } from "~/components/ui/ContentCard";

import { mapBackendToCard } from "~/utils/mappers";
import type { ContentType } from "~/types/content";
import { ROUTES } from "~/constants/routes";

export function meta() {
  return [
    { title: "Feed — NomadLogs" },
    {
      name: "description",
      content: "Stay up to date with content from authors you follow.",
    },
  ];
}

export default function Feed() {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Fetch feed
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.explore.feed.useInfiniteQuery(
      {
        limit: 10,
      },
      {
        enabled: isAuthenticated,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: undefined,
      },
    );

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const allItems =
    data?.pages.flatMap((page) =>
      page.items.map((item) =>
        mapBackendToCard(item, item.contentType.toLowerCase() as ContentType),
      ),
    ) ?? [];

  const isEmpty = data?.pages[0]?.isEmpty ?? false;

  if (!isAuthenticated) {
    return (
      <article className="h-[calc(100vh-64px)] flex items-center justify-center">
        <EmptyState
          icon={<Users size={64} strokeWidth={1} />}
          title="Please log in to view your feed"
          description="Log in to follow other travellers and see their journeys here."
          actionLabel="Log In"
          actionHref={ROUTES.LOGIN}
        />
      </article>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading feed...
      </div>
    );
  }

  if (isEmpty || allItems.length === 0) {
    return (
      <article className="h-[calc(100vh-64px)] flex items-center justify-center">
        <EmptyState
          icon={<Users size={64} strokeWidth={1} />}
          title="You're not following anyone yet"
          description="Head to the Explore page to discover and follow your favourite travellers!"
          actionLabel="Explore Travels & Plans"
          actionHref={ROUTES.EXPLORE}
        />
      </article>
    );
  }

  return (
    <article className="animate-fade-in max-w-5xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="text-headline-lg text-on-surface">Your Feed</h1>
        <p className="text-body-md text-on-surface-muted mt-1">
          Latest content from authors you follow
        </p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allItems.map((item) => (
          <li key={`${item.contentType}-${item.id}`}>
            <ContentCard data={item} />
          </li>
        ))}
      </ul>

      {/* Infinite scroll sentinel */}
      <div
        ref={sentinelRef}
        className="py-8 text-center text-label-md text-on-surface-muted"
      >
        {isFetchingNextPage ? "Loading more..." : ""}
      </div>
    </article>
  );
}
