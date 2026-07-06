import { useState, Suspense, lazy } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { SearchBar } from "~/components/ui/SearchBar";
import { Tag } from "~/components/ui/Tag";
import { ContentCard } from "~/components/ui/ContentCard";
import { SplitPane } from "~/components/layout/SplitPane";
import { EmptyState } from "~/components/ui/EmptyState";
import { trpc } from "~/utils/trpc";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { useToast } from "~/providers/ToastProvider";
import { useLocationSearch } from "~/hooks/useLocationSearch";
import { mapBackendToCard } from "~/utils/mappers";
import type { LocationSuggestion } from "~/utils/geocoding";
import type { ContentType } from "~/types/content";

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView }))
);

export function meta() {
  return [
    { title: "Explore Travels & Plans — NomadLogs" },
    { name: "description", content: "Discover journals, blogs, and travel plans from travellers around the world." },
  ];
}

const CONTENT_TYPES = [
  { key: "journals", label: "Journals", val: "JOURNAL" },
  { key: "blogs", label: "Blogs", val: "BLOG" },
  { key: "travel-plans", label: "Travel Plans", val: "TRAVEL_PLAN" },
];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "popular", label: "Most Popular" },
];

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const {
    query: locationSearchValue,
    setQuery: setLocationSearchValue,
    suggestions: locationSuggestions,
    setSuggestions: setLocationSuggestions,
  } = useLocationSearch("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const { toast: showToast } = useToast();

  // Filters from URL
  const activeTypes = searchParams.getAll("type").length > 0
    ? searchParams.getAll("type")
    : ["BLOG", "JOURNAL", "TRAVEL_PLAN"];
  const activeSort = (searchParams.get("sort") as "newest" | "oldest" | "popular") ?? "newest";
  
  const locationIds = searchParams.getAll("locationId");
  const locationNames = searchParams.getAll("locationName");
  
  const tagIds = searchParams.getAll("tagId");
  const tagNames = searchParams.getAll("tagName");

  // Fetch all tags from database
  const { data: dbTags } = trpc.tag.listTags.useQuery({ limit: 100 });

  // Mutations
  const upsertLocationMutation = trpc.tag.upsertLocation.useMutation();

  const handleSelectLocation = async (suggestion: LocationSuggestion) => {
    try {
      const result = await upsertLocationMutation.mutateAsync({
        name: suggestion.label.split(",")[0] || suggestion.label,
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        osmId: String(suggestion.id),
      });

      const newParams = new URLSearchParams(searchParams);
      newParams.append("locationId", result.id);
      newParams.append("locationName", result.name);
      setSearchParams(newParams);
      setLocationSearchValue("");
      setLocationSuggestions([]);
    } catch (err) {
      console.error(err);
      showToast("Failed to link location.", "error");
    }
  };

  const handleRemoveLocation = (id: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("locationId");
    newParams.delete("locationName");
    locationIds.filter((lid) => lid !== id).forEach((lid, index) => {
      newParams.append("locationId", lid);
      newParams.append("locationName", locationNames[index]!);
    });
    setSearchParams(newParams);
  };

  const handleToggleTag = (tag: { id: string; name: string }) => {
    const newParams = new URLSearchParams(searchParams);
    const currentIds = newParams.getAll("tagId");
    newParams.delete("tagId");
    newParams.delete("tagName");

    if (currentIds.includes(tag.id)) {
      currentIds.filter((cid) => cid !== tag.id).forEach((cid) => {
        newParams.append("tagId", cid);
        const found = dbTags?.find((t) => t.id === cid);
        if (found) newParams.append("tagName", found.name);
      });
    } else {
      currentIds.forEach((cid) => {
        newParams.append("tagId", cid);
        const found = dbTags?.find((t) => t.id === cid);
        if (found) newParams.append("tagName", found.name);
      });
      newParams.append("tagId", tag.id);
      newParams.append("tagName", tag.name);
    }
    setSearchParams(newParams);
  };

  const toggleType = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    const current = newParams.getAll("type");
    newParams.delete("type");
    if (current.includes(val)) {
      current.filter((t) => t !== val).forEach((t) => newParams.append("type", t));
    } else {
      current.forEach((t) => newParams.append("type", t));
      newParams.append("type", val);
    }
    setSearchParams(newParams);
  };

  const handleSetSort = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", val);
    setSearchParams(newParams);
  };

  // Fetch list of contents
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.explore.list.useInfiniteQuery(
      {
        contentTypes: activeTypes as ("BLOG" | "JOURNAL" | "TRAVEL_PLAN")[],
        sort: activeSort,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        locationIds: locationIds.length > 0 ? locationIds : undefined,
        limit: 10,
      },
      {
        getNextPageParam: (lastPage) => {
          const pageWithCursor = lastPage.find((res) => res.nextCursor);
          return pageWithCursor?.nextCursor;
        },
        initialPageParam: undefined,
      }
    );

  const sentinelRef = useInfiniteScroll({
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const allItems = data?.pages.flatMap((page) =>
    page.flatMap((res) =>
      res.items.map((item) => mapBackendToCard(item, res.contentType.toLowerCase() as ContentType))
    )
  ) ?? [];

  // Map pins from items to display on MapView
  const mapPins = data?.pages.flatMap((page) =>
    page.flatMap((res) =>
      res.items.flatMap((item) =>
        item.locations?.map((l) => ({
          id: l.location.id,
          lat: l.location.latitude,
          lng: l.location.longitude,
          label: l.location.name,
          color: res.contentType === "BLOG" ? "#E07A5F" : res.contentType === "JOURNAL" ? "#1A4D3E" : "#3B7197",
        })) ?? []
      )
    )
  ) ?? [];

  const leftContent = (
    <section className="h-full flex flex-col p-4">
      {/* Location Search */}
      <SearchBar
        placeholder="Search locations..."
        value={locationSearchValue}
        onChange={setLocationSearchValue}
        suggestions={locationSuggestions}
        onSuggestionSelect={handleSelectLocation}
        onSubmit={() => {}}
        forceSelection={true}
        size="md"
        className="mb-3"
      />

      {/* Active location tags */}
      {locationIds.length > 0 && (
        <nav className="flex flex-wrap gap-1.5 mb-3" aria-label="Active locations">
          {locationIds.map((lid, idx) => (
            <Tag
              key={lid}
              label={locationNames[idx] || "Location"}
              variant="location"
              isActive
              isRemovable
              onRemove={() => handleRemoveLocation(lid)}
              size="sm"
            />
          ))}
        </nav>
      )}

      {/* Map */}
      <section className="flex-1 min-h-[300px]">
        <Suspense fallback={<section className="w-full h-full skeleton rounded-2xl" />}>
          <MapView
            pins={mapPins}
            className="h-full"
            zoom={2}
            center={[20, 0]}
          />
        </Suspense>
      </section>
    </section>
  );

  const rightContent = (
    <section className="h-full flex flex-col">
      {/* Filters bar */}
      <header className="sticky top-0 z-10 bg-neutral/95 backdrop-blur-sm border-b border-border-custom px-4 py-3 space-y-3">
        <nav className="flex items-center justify-between" aria-label="Content type filters">
          <ul className="flex items-center gap-2">
            {CONTENT_TYPES.map((type) => (
              <li key={type.key}>
                <Tag
                  label={type.label}
                  variant="content-type"
                  isActive={activeTypes.includes(type.val)}
                  onToggle={() => toggleType(type.val)}
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-lg text-on-surface-muted hover:text-on-surface hover:bg-border-custom/50 transition-all"
          >
            <SlidersHorizontal size={14} />
            Filter & Sort
            {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </nav>

        {/* Expanded filters */}
        {isFilterExpanded && (
          <section className="space-y-4 pt-2 animate-slide-down">
            {/* Sort */}
            <fieldset>
              <legend className="text-label-md text-on-surface-muted mb-2">Sort by</legend>
              <ul className="flex items-center gap-2">
                {SORT_OPTIONS.map((option) => (
                  <li key={option.key}>
                    <Tag
                      label={option.label}
                      isActive={activeSort === option.key}
                      onToggle={() => handleSetSort(option.key)}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>

            {/* Categories */}
            <fieldset className="space-y-2">
              <div className="flex items-center justify-between">
                <legend className="text-label-md text-on-surface-muted">Categories</legend>
                <input
                  type="text"
                  placeholder="Filter tags..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-32 rounded-lg bg-surface border border-border-custom px-2 py-1 text-label-sm text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              <ul className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {dbTags?.filter((tag) =>
                  tag.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                ).map((tag) => (
                  <li key={tag.id}>
                    <Tag
                      label={tag.name}
                      isActive={tagIds.includes(tag.id)}
                      onToggle={() => handleToggleTag(tag)}
                      size="sm"
                    />
                  </li>
                ))}
                {dbTags?.length === 0 && (
                  <li className="text-label-sm text-on-surface-muted italic list-none">
                    No tags available
                  </li>
                )}
              </ul>
            </fieldset>
          </section>
        )}
      </header>

      {/* Content grid */}
      <section className="flex-1 overflow-y-auto p-4">
        {allItems.length > 0 ? (
          <ul className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {allItems.map((item) => (
              <li key={`${item.contentType}-${item.id}`}>
                <ContentCard data={item} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No content found"
            description="Try adjusting your filters or search for different locations."
            actionLabel="Clear Filters"
            onAction={() => setSearchParams(new URLSearchParams())}
          />
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="py-8 text-center text-label-md text-on-surface-muted">
          {isFetchingNextPage ? "Loading more..." : ""}
        </div>
      </section>
    </section>
  );

  return (
    <article className="h-[calc(100vh-64px)]">
      <SplitPane
        left={leftContent}
        right={rightContent}
        initialLeftPercent={45}
        minLeftPercent={25}
        maxLeftPercent={65}
        className="h-full"
      />
    </article>
  );
}
