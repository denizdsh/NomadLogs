import { Suspense, lazy, useEffect } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { SplitPane } from "~/components/layout/SplitPane";
import { Button } from "~/components/ui/Button";
import { Tag as UTag } from "~/components/ui/Tag";
import { SearchBar } from "~/components/ui/SearchBar";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { uploadImage } from "~/utils/upload";
import { useToast } from "~/providers/ToastProvider";
import { useNavigate, useSearchParams } from "react-router";
import type { Location, LocationSuggestion } from "~/utils/geocoding";
import { searchLocation } from "~/utils/geocoding";
import { useMachine } from "@xstate/react";
import { blogMachine } from "~/machines/blogMachine";
import type { Visibility } from "~/types/content";
import { VISIBILITIES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";
import { MACHINE_STATES } from "~/constants/machine";
import { RichEditor } from "~/components/ui/RichEditor";
import { useRichEditor } from "~/hooks/useRichEditor";

type BlogDetailType = NonNullable<RouterOutputs["blog"]["getBySlug"]>;

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView }))
);

export function meta() {
  return [
    { title: "Create Blog — NomadLogs" },
    { name: "description", content: "Write and publish a new travel blog post." },
  ];
}

export default function BlogNew() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();
  const editSlug = searchParams.get("edit");

  // Initialize machine
  const [state, send] = useMachine(blogMachine);

  // Destructure context
  const {
    title,
    description,
    visibility,
    featuredImageUrl,
    selectedJournalId,
    selectedTagIds,
    selectedLocations,
    locationSearchValue,
    locationSuggestions,
    tagSearchQuery,
  } = state.context;

  const editor = useRichEditor();

  // Fetch journals for dropdown selection
  const { data: myJournals } = trpc.journal.getMyJournals.useQuery();

  // Fetch tags for category selection
  const { data: dbTags } = trpc.tag.listTags.useQuery({ limit: 100 });

  // Fetch blog if in edit mode
  const { data: editBlogData, isLoading: isEditLoading } = trpc.blog.getBySlug.useQuery(
    { slug: editSlug || "" },
    { enabled: !!editSlug }
  );
  const editBlog = editBlogData as BlogDetailType | undefined;

  // Populate form if editing
  useEffect(() => {
    if (editBlog) {
      send({ type: "LOAD_BLOG", blogData: editBlog });
    }
  }, [editBlog, send]);

  // Nominatim search autocomplete effect
  useEffect(() => {
    if (locationSearchValue.trim().length < 3) {
      send({ type: "SET_LOCATION_SUGGESTIONS", suggestions: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const items = await searchLocation(locationSearchValue);
        send({ type: "SET_LOCATION_SUGGESTIONS", suggestions: items });
      } catch (err) {
        console.error(err);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [locationSearchValue, send]);


  // Mutations
  const upsertLocationMutation = trpc.tag.upsertLocation.useMutation();
  const createBlogMutation = trpc.blog.create.useMutation();
  const updateBlogMutation = trpc.blog.update.useMutation();
  const changeVisibilityMutation = trpc.blog.changeVisibility.useMutation();

  const handleSelectLocation = async (suggestion: LocationSuggestion) => {
    try {
      const result = await upsertLocationMutation.mutateAsync({
        name: suggestion.label.split(",")[0] || suggestion.label,
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        osmId: String(suggestion.id),
      });

      send({ type: "ADD_LOCATION", location: result });
    } catch (err) {
      toast("Failed to add location.", "error");
    }
  };

  const handleRemoveLocation = (id: string) => {
    send({ type: "REMOVE_LOCATION", locationId: id });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    send({ type: "UPLOAD_START" });
    try {
      const url = await uploadImage(file);
      send({ type: "UPLOAD_SUCCESS", url });
      toast("Image uploaded successfully!", "success");
    } catch (err: any) {
      send({ type: "UPLOAD_FAILURE", error: err.message || "Failed to upload image." });
      toast(err.message || "Failed to upload image.", "error");
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast("Please enter a title.", "warning");
    if (!editor.editorRef.current) return;

    send({ type: "SUBMIT" });
    try {
      const contentData = await editor.save();
      let finalSlug = editSlug || "";

      if (editSlug && editBlog) {
        // Update blog metadata and content
        const updatePayload = {
          blogId: editBlog.id,
          title,
          description: description || title,
          content: contentData,
          featuredImageUrl: featuredImageUrl || null,
          tagIds: selectedTagIds,
          locations: selectedLocations.map((loc, index) => ({
            locationId: loc.id,
            order: index,
          })),
        };
        const updatedBlog = await updateBlogMutation.mutateAsync(updatePayload);

        // Update visibility if changed
        if (visibility !== editBlog.visibility) {
          await changeVisibilityMutation.mutateAsync({
            blogId: editBlog.id,
            visibility,
          });
        }
        finalSlug = updatedBlog.slug;
        toast("Blog updated successfully!", "success");
      } else {
        // Create new blog
        const payload = {
          title,
          description: description || title,
          content: contentData,
          featuredImageUrl: featuredImageUrl || undefined,
          visibility,
          journalId: selectedJournalId || undefined,
          tagIds: selectedTagIds,
          locations: selectedLocations.map((loc, index) => ({
            locationId: loc.id,
            order: index,
          })),
        };

        const result = await createBlogMutation.mutateAsync(payload);
        finalSlug = result.slug;
        toast("Blog created successfully!", "success");
      }

      send({ type: "SUBMIT_SUCCESS" });
      utils.explore.list.invalidate();
      if (editSlug) {
        utils.blog.getBySlug.invalidate({ slug: editSlug });
      }
      navigate(ROUTES.BLOG.DETAIL(finalSlug));
    } catch (err: any) {
      console.error(err);
      send({ type: "SUBMIT_FAILURE", error: err.message || "Failed to save blog." });
      toast(err.message || "Failed to save blog.", "error");
    }
  };

  if (isEditLoading) {
    return <div className="p-8 text-center text-body-lg skeleton-shimmer">Loading existing blog post...</div>;
  }

  const mapPins = selectedLocations.map((loc) => ({
    id: loc.id,
    lat: loc.latitude,
    lng: loc.longitude,
    label: loc.name,
    color: "#E07A5F",
  }));

  const leftContent = (
    <section className="p-6 space-y-8">
      {/* Blog Details Form */}
      <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-5">
        <h1 className="text-headline-lg text-on-surface">
          {editSlug ? "Edit Blog Post" : "New Blog Post"}
        </h1>

        {/* Thumbnail */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface">Featured Image</legend>
          {featuredImageUrl ? (
            <figure className="relative h-48 rounded-xl overflow-hidden border border-border-custom bg-neutral">
              <img src={featuredImageUrl} alt="Featured Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => send({ type: "REMOVE_FEATURED_IMAGE" })}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-lg p-1.5 hover:bg-black transition-colors text-label-sm"
              >
                Remove
              </button>
            </figure>
          ) : (
            <label
              htmlFor="featured-image"
              className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-border-custom bg-neutral hover:border-primary/50 transition-colors cursor-pointer"
            >
              <ImagePlus size={32} className="text-on-surface-muted mb-2 animate-pulse" />
              <span className="text-body-sm text-on-surface-muted">
                {state.matches(MACHINE_STATES.UPLOADING) ? "Uploading..." : "Click to upload featured image"}
              </span>
              <input
                id="featured-image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={state.matches(MACHINE_STATES.UPLOADING)}
              />
            </label>
          )}
        </fieldset>

        {/* Title */}
        <fieldset className="space-y-1">
          <legend className="text-label-lg text-on-surface">Title</legend>
          <input
            type="text"
            value={title}
            onChange={(e) => send({ type: "SET_TITLE", title: e.target.value })}
            placeholder="Give your blog a title..."
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-lg focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-serif"
          />
        </fieldset>

        {/* Locations */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface">Locations (in itinerary order)</legend>
          <SearchBar
            placeholder="Search and add locations..."
            value={locationSearchValue}
            onChange={(val) => send({ type: "SET_LOCATION_SEARCH", value: val })}
            suggestions={locationSuggestions}
            onSuggestionSelect={handleSelectLocation}
            onSubmit={() => {}}
            forceSelection={true}
            size="sm"
          />
          {selectedLocations.length > 0 && (
            <nav className="flex flex-wrap gap-1.5" aria-label="Selected locations">
              {selectedLocations.map((loc) => (
                <UTag
                  key={loc.id}
                  label={loc.name}
                  variant="location"
                  isRemovable
                  onRemove={() => handleRemoveLocation(loc.id)}
                  size="sm"
                />
              ))}
            </nav>
          )}
        </fieldset>

        {/* Category tags selector */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface font-semibold">Tags</legend>
          <input
            type="text"
            placeholder="Filter tags..."
            value={tagSearchQuery}
            onChange={(e) => send({ type: "SET_TAG_SEARCH", query: e.target.value })}
            className="w-full rounded-xl bg-neutral border border-border-custom px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <ul className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {dbTags?.filter((tag) =>
              tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
            ).map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <li key={tag.id}>
                  <UTag
                    label={tag.name}
                    isActive={isSelected}
                    onToggle={() => send({ type: "TOGGLE_TAG", tagId: tag.id })}
                    size="sm"
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>

        {/* Description summary */}
        <fieldset className="space-y-1">
          <legend className="text-label-lg text-on-surface">Description Summary</legend>
          <textarea
            value={description}
            onChange={(e) => send({ type: "SET_DESCRIPTION", description: e.target.value })}
            placeholder="A brief summary of your blog post..."
            rows={3}
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </fieldset>

        {/* Visibility */}
        <fieldset className="space-y-1">
          <legend className="text-label-lg text-on-surface font-semibold">Visibility</legend>
          <select
            value={visibility}
            onChange={(e) => send({ type: "SET_VISIBILITY", visibility: e.target.value as any })}
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          >
            <option value={VISIBILITIES.PRIVATE}>Private</option>
            <option value={VISIBILITIES.UNLISTED}>Unlisted</option>
            <option value={VISIBILITIES.PUBLIC}>Public</option>
          </select>
        </fieldset>

        {/* Include in Journal */}
        {!editSlug && (
          <fieldset className="space-y-1">
            <legend className="text-label-lg text-on-surface font-semibold">Include in Journal</legend>
            <select
              value={selectedJournalId}
              onChange={(e) => send({ type: "SET_JOURNAL_ID", journalId: e.target.value })}
              className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            >
              <option value="">Standalone (no journal)</option>
              {myJournals?.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </fieldset>
        )}

        {/* Save/Publish */}
        <Button variant="primary" size="lg" className="w-full" onClick={handleSubmit} disabled={state.matches(MACHINE_STATES.SAVING)}>
          <Upload size={16} />
          {state.matches(MACHINE_STATES.SAVING)
            ? "Saving Blog..."
            : visibility === VISIBILITIES.PRIVATE
            ? "Save Draft"
            : "Publish & Request Verification"}
        </Button>
      </section>

      {/* Editor.js content area */}
      <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4">
        <h2 className="text-headline-md text-on-surface font-serif">Content Block Editor</h2>
        {!isEditLoading && (
          <RichEditor
            id="editorjs-container"
            placeholder="Start typing your travel story..."
            data={editBlog?.content ? (editBlog.content as any) : { blocks: [] }}
            onInitialize={editor.onInitialize}
            onDestroy={editor.onDestroy}
            className="min-h-[400px] rounded-xl border border-dashed border-border-custom p-6 bg-neutral/10"
          />
        )}
      </section>
    </section>
  );

  const rightContent = (
    <section className="h-full p-4">
      <Suspense fallback={<section className="w-full h-full skeleton rounded-2xl" />}>
        {mapPins.length > 0 ? (
          <MapView
            pins={mapPins}
            paths={[{
              positions: mapPins.map((p: any) => [p.lat, p.lng] as [number, number]),
              color: "#E07A5F",
            }]}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic">Add locations to visualize path.</div>
        )}
      </Suspense>
    </section>
  );

  return (
    <article className="h-[calc(100vh-64px)]">
      <SplitPane
        left={leftContent}
        right={rightContent}
        initialLeftPercent={60}
        minLeftPercent={40}
        maxLeftPercent={100}
        className="h-full"
      />
    </article>
  );
}
