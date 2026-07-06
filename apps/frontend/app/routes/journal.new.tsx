import { useState, useEffect, Suspense, lazy } from "react";
import { Upload, ImagePlus, Plus, GripVertical, Trash2 } from "lucide-react";
import { SplitPane } from "~/components/layout/SplitPane";
import { Button } from "~/components/ui/Button";
import { Tag as UTag } from "~/components/ui/Tag";
import { SearchBar } from "~/components/ui/SearchBar";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { uploadImage } from "~/utils/upload";
import { useToast } from "~/providers/ToastProvider";
import { useNavigate, useSearchParams } from "react-router";
import { DropdownMenu } from "~/components/ui/DropdownMenu";
import { ContentCard } from "~/components/ui/ContentCard";
import type { Location, LocationSuggestion } from "~/utils/geocoding";
import { searchLocation } from "~/utils/geocoding";
import { AddBlogModal } from "~/components/journal/AddBlogModal";
import { SwapPositionModal } from "~/components/journal/SwapPositionModal";
import { DragConfirmModal } from "~/components/journal/DragConfirmModal";
import { useMachine } from "@xstate/react";
import { journalMachine } from "~/machines/journalMachine";
import type { Visibility } from "~/types/content";
import { VISIBILITIES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";
import { MACHINE_STATES } from "~/constants/machine";

interface BlogItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  featuredImageUrl?: string | null;
  visibility?: string;
  verificationStatus?: string;
  locations?: { location: Location }[];
  tags?: { tagId: string }[];
}

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView }))
);

export function meta() {
  return [
    { title: "Manage Journal — NomadLogs" },
    { name: "description", content: "Create or edit a journal collection of travel blog posts." },
  ];
}

const BLOG_COLORS = ["#E07A5F", "#3B7197", "#1A4D3E", "#D97706", "#8B5CF6", "#EC4899", "#10B981"];

export default function JournalNew() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();
  const editSlug = searchParams.get("edit");
  const isEditMode = !!editSlug;

  // Initialize machine
  const [state, send] = useMachine(journalMachine);

  // Destructure context
  const {
    title,
    description,
    visibility,
    featuredImageUrl,
    selectedTagIds,
    selectedLocations,
    blogsInJournal,
    locationSearchValue,
    locationSuggestions,
    tagSearchQuery,
    draggedBlogIndex,
    draggedOverBlogIndex,
    blogToSwap,
    swapPositionValue,
  } = state.context;

  // Modals (simple UI toggles as per guidelines)
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isAddBlogModalOpen, setIsAddBlogModalOpen] = useState(false);

  // Queries
  const { data: dbTags } = trpc.tag.listTags.useQuery({ limit: 100 });
  const { data: editJournal, isLoading: isEditJournalLoading } = trpc.journal.getBySlug.useQuery(
    { slug: editSlug || "" },
    { enabled: isEditMode }
  );
  const { data: standaloneBlogs } = trpc.blog.getStandaloneBlogs.useQuery(
    undefined,
    { enabled: isAddBlogModalOpen }
  );

  // Mutations
  const upsertLocationMutation = trpc.tag.upsertLocation.useMutation();
  const createJournalMutation = trpc.journal.create.useMutation();
  const updateJournalMutation = trpc.journal.update.useMutation();
  const addBlogMutation = trpc.journal.addBlog.useMutation();
  const removeBlogMutation = trpc.journal.removeBlog.useMutation();
  const reorderBlogsMutation = trpc.journal.reorderBlogs.useMutation();

  // Populate data on edit mode
  useEffect(() => {
    if (isEditMode && editJournal) {
      send({ type: "LOAD_JOURNAL", journalData: editJournal });
    }
  }, [isEditMode, editJournal, send]);

  // Geocoding Nominatim autocomplete effect
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

  // Location Handlers
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

  // Thumbnail Upload
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

  // Save / Publish metadata
  const handleSubmit = async () => {
    if (!title.trim()) return toast("Please enter a title.", "warning");

    send({ type: "SUBMIT" });
    try {
      const payload = {
        title,
        description: description || title,
        featuredImageUrl: featuredImageUrl || undefined,
        visibility,
        tagIds: selectedTagIds,
        locationIds: selectedLocations.map((loc) => loc.id),
      };

      if (isEditMode && editJournal) {
        await updateJournalMutation.mutateAsync({
          journalId: editJournal.id,
          ...payload,
        });
        toast("Journal updated successfully!", "success");
        utils.journal.getBySlug.invalidate({ slug: editSlug! });
        send({ type: "SUBMIT_SUCCESS" });
        navigate(ROUTES.JOURNAL.DETAIL(editJournal.slug));
      } else {
        const result = await createJournalMutation.mutateAsync(payload);

        // Link any selected blogs to the new journal
        if (blogsInJournal.length > 0) {
          for (const blog of blogsInJournal) {
            await addBlogMutation.mutateAsync({
              journalId: result.id,
              blogId: blog.id,
            });
          }
        }

        toast("Journal created successfully!", "success");
        send({ type: "SUBMIT_SUCCESS" });
        utils.explore.list.invalidate();
        navigate(ROUTES.JOURNAL.DETAIL(result.slug));
      }
    } catch (err: any) {
      const errMsg = err.message || "Failed to save journal.";
      send({ type: "SUBMIT_FAILURE", error: errMsg });
      toast(errMsg, "error");
    }
  };

  // Blog list mutations (Direct mutations if EditMode, else state machine context updates)
  const handleAddBlogToJournal = async (blog: any) => {
    try {
      if (isEditMode && editJournal) {
        await addBlogMutation.mutateAsync({
          journalId: editJournal.id,
          blogId: blog.id,
        });
        utils.journal.getBySlug.invalidate({ slug: editSlug! });
        toast("Blog added to journal.", "success");
      }
      send({ type: "ADD_BLOG_TO_JOURNAL", blog });
    } catch (err: any) {
      toast(err.message || "Failed to add blog.", "error");
    } finally {
      setIsAddBlogModalOpen(false);
    }
  };

  const handleRemoveBlogFromJournal = async (blogId: string) => {
    try {
      if (isEditMode && editJournal) {
        await removeBlogMutation.mutateAsync({
          journalId: editJournal.id,
          blogId,
        });
        utils.journal.getBySlug.invalidate({ slug: editSlug! });
        toast("Blog removed from journal.", "success");
      }
      send({ type: "REMOVE_BLOG_FROM_JOURNAL", blogId });
    } catch (err: any) {
      toast(err.message || "Failed to remove blog.", "error");
    }
  };

  const handleConfirmReorder = async () => {
    const pending = state.context.dragPendingIndex;
    if (!pending) return;
    const { from, to } = pending;
    const newBlogs = [...blogsInJournal];
    const [moved] = newBlogs.splice(from, 1);
    newBlogs.splice(to, 0, moved);

    try {
      if (isEditMode && editJournal) {
        await reorderBlogsMutation.mutateAsync({
          journalId: editJournal.id,
          blogIds: newBlogs.map((b) => b.id),
        });
        utils.journal.getBySlug.invalidate({ slug: editSlug! });
        toast("Journal order updated.", "success");
      }
      send({ type: "CONFIRM_REORDER", newBlogs });
    } catch (err: any) {
      toast(err.message || "Failed to swap order.", "error");
      send({ type: "CANCEL_REORDER" });
    }
  };

  const handleSwapPosition = () => {
    if (!blogToSwap) return;
    const fromIndex = blogsInJournal.findIndex((b) => b.id === blogToSwap.id);
    const toIndex = swapPositionValue - 1;

    if (toIndex < 0 || toIndex >= blogsInJournal.length) {
      return toast("Invalid index target.", "warning");
    }

    send({ type: "INITIATE_DRAG_DROP", from: fromIndex, to: toIndex });
    setIsSwapModalOpen(false);
  };

  // Draggable Event Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", String(index));
    send({ type: "SET_DRAG_START", index });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    send({ type: "SET_DRAG_OVER", index });
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(fromIndex) || fromIndex === toIndex) return;

    send({ type: "INITIATE_DRAG_DROP", from: fromIndex, to: toIndex });
  };

  // Map Data calculations
  const mapPins = blogsInJournal.flatMap((blog, blogIndex) =>
    blog.locations?.map((l: any) => ({
      id: `${blog.id}-${l.location.id}`,
      lat: l.location.latitude,
      lng: l.location.longitude,
      label: `#${blogIndex + 1}: ${blog.title} — ${l.location.name}`,
      color: BLOG_COLORS[blogIndex % BLOG_COLORS.length],
    })) ?? []
  ) ?? [];

  const mapPaths = blogsInJournal.map((blog, blogIndex) => {
    const positions = blog.locations?.map((l: any) => [l.location.latitude, l.location.longitude] as [number, number]) ?? [];
    return {
      positions,
      color: BLOG_COLORS[blogIndex % BLOG_COLORS.length],
    };
  }).filter(p => p.positions.length > 1);

  if (isEditMode && isEditJournalLoading) {
    return <div className="p-8 text-center text-body-lg skeleton-shimmer">Loading journal data...</div>;
  }

  const leftContent = (
    <section className="p-6 space-y-8 pb-24">
      <header>
        <h1 className="text-headline-lg text-on-surface">
          {isEditMode ? `Edit Journal: ${title}` : "New Journal"}
        </h1>
      </header>

      {/* Details section */}
      <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-6">
        <h2 className="text-label-lg text-on-surface font-semibold border-b border-border-custom pb-2">Journal Details</h2>
        
        {/* Featured Image */}
        <fieldset className="space-y-2">
          <legend className="text-label-md text-on-surface font-medium">Featured Image</legend>
          {featuredImageUrl ? (
            <figure className="relative h-44 rounded-xl overflow-hidden border border-border-custom bg-neutral">
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
              htmlFor="featured-image-upload"
              className="flex flex-col items-center justify-center h-44 rounded-xl border-2 border-dashed border-border-custom bg-neutral hover:border-primary/50 transition-colors cursor-pointer"
            >
              <ImagePlus size={28} className="text-on-surface-muted mb-2 animate-pulse" />
              <span className="text-body-sm text-on-surface-muted">
                {state.matches(MACHINE_STATES.UPLOADING) ? "Uploading..." : "Click to upload featured image"}
              </span>
              <input
                id="featured-image-upload"
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
          <legend className="text-label-md text-on-surface font-medium">Journal Title</legend>
          <input
            type="text"
            value={title}
            onChange={(e) => send({ type: "SET_TITLE", title: e.target.value })}
            placeholder="Give your journal collection a title..."
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-serif"
          />
        </fieldset>

        {/* Locations */}
        <fieldset className="space-y-2">
          <legend className="text-label-md text-on-surface font-medium">Location Tags</legend>
          <SearchBar
            placeholder="Add location tag..."
            value={locationSearchValue}
            onChange={(val) => send({ type: "SET_LOCATION_SEARCH", value: val })}
            suggestions={locationSuggestions}
            onSuggestionSelect={handleSelectLocation}
            onSubmit={() => {}}
            forceSelection={true}
            size="sm"
          />
          {selectedLocations.length > 0 && (
            <nav className="flex flex-wrap gap-1.5 pt-1" aria-label="Selected locations">
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
          <legend className="text-label-md text-on-surface font-medium">Category Tags</legend>
          <input
            type="text"
            placeholder="Search category tags..."
            value={tagSearchQuery}
            onChange={(e) => send({ type: "SET_TAG_SEARCH", query: e.target.value })}
            className="w-full rounded-xl bg-neutral border border-border-custom px-3 py-2.5 text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
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
          <legend className="text-label-md text-on-surface font-medium">Description</legend>
          <textarea
            value={description}
            onChange={(e) => send({ type: "SET_DESCRIPTION", description: e.target.value })}
            placeholder="Write a description summary..."
            rows={4}
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </fieldset>

        {/* Visibility */}
        <fieldset className="space-y-1">
          <legend className="text-label-md text-on-surface font-medium">Visibility</legend>
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
      </section>

      {/* Journal Content (Blogs) */}
      <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-border-custom pb-2">
          <h2 className="text-label-lg text-on-surface font-semibold">Blogs in Journal</h2>
          <Button variant="secondary" size="sm" onClick={() => setIsAddBlogModalOpen(true)}>
            <Plus size={14} />
            Add Blog
          </Button>
        </div>

        {blogsInJournal.length > 0 ? (
          <ul className="space-y-3">
            {blogsInJournal.map((blog, index) => {
              const mappedBlog = {
                id: blog.id,
                slug: blog.slug,
                title: blog.title,
                summary: blog.description,
                featuredImageUrl: blog.featuredImageUrl,
                visibility: blog.visibility,
                verificationStatus: blog.verificationStatus,
                contentType: "blog" as const,
                contentTypeLabel: `Post #${index + 1}`,
              };

              const cardActions = [
                {
                  label: "Change Order",
                  onClick: () => {
                    send({ type: "INITIATE_SWAP", blog, index });
                    setIsSwapModalOpen(true);
                  },
                },
                {
                  label: "Remove from Journal",
                  onClick: () => handleRemoveBlogFromJournal(blog.id),
                  variant: "danger" as const,
                },
              ];

              return (
                <li
                  key={blog.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`flex items-center gap-3 p-2 rounded-xl border border-transparent transition-all ${
                    draggedBlogIndex === index ? "opacity-40" : ""
                  } ${draggedOverBlogIndex === index ? "border-primary bg-primary/5" : ""}`}
                >
                  <figure className="text-on-surface-muted cursor-grab active:cursor-grabbing p-1.5 hover:bg-neutral rounded-lg">
                    <GripVertical size={16} />
                  </figure>
                  <div className="flex-1 min-w-0">
                    <ContentCard data={mappedBlog} />
                  </div>
                  <div className="flex-shrink-0">
                    <DropdownMenu items={cardActions} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-on-surface-muted italic text-center py-6">
            No blogs linked to this journal. Click "Add Blog" above to select standalone blog posts.
          </div>
        )}
      </section>

      {/* Save Button */}
      <footer className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto bg-surface/80 backdrop-blur border-t border-border-custom p-4 md:p-0 md:bg-transparent md:border-none">
        <Button variant="primary" size="lg" className="w-full" onClick={handleSubmit} disabled={state.matches(MACHINE_STATES.SAVING)}>
          <Upload size={16} />
          {state.matches(MACHINE_STATES.SAVING)
            ? "Saving Journal..."
            : isEditMode
            ? "Save Changes"
            : visibility === VISIBILITIES.PRIVATE
            ? "Save Draft"
            : "Publish & Request Verification"}
        </Button>
      </footer>
    </section>
  );

  const rightContent = (
    <section className="h-full p-4">
      <Suspense fallback={<section className="w-full h-full skeleton rounded-2xl" />}>
        {mapPins.length > 0 ? (
          <MapView pins={mapPins} paths={mapPaths} className="h-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic text-center px-8">
            No locations mapped. Mapped locations of blogs in this journal will automatically appear here as pins and paths.
          </div>
        )}
      </Suspense>
    </section>
  );

  return (
    <article className="h-[calc(100vh-64px)]">
      <SplitPane
        left={leftContent}
        right={rightContent}
        initialLeftPercent={55}
        minLeftPercent={35}
        maxLeftPercent={85}
        className="h-full"
      />

      {/* Add Standalone Blog Modal */}
      <AddBlogModal
        isOpen={isAddBlogModalOpen}
        onClose={() => setIsAddBlogModalOpen(false)}
        standaloneBlogs={standaloneBlogs}
        blogsInJournal={blogsInJournal}
        onAdd={handleAddBlogToJournal}
      />

      {/* Swap Order Position Modal */}
      <SwapPositionModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        blogTitle={blogToSwap?.title}
        maxPosition={blogsInJournal.length}
        positionValue={swapPositionValue}
        onChangePosition={(val) => send({ type: "SET_SWAP_POSITION_VALUE", value: val })}
        onConfirm={handleSwapPosition}
      />

      {/* Drag & Drop Confirm Modal */}
      <DragConfirmModal
        isOpen={state.matches(MACHINE_STATES.REORDERING)}
        onClose={() => send({ type: "CANCEL_REORDER" })}
        onConfirm={handleConfirmReorder}
        isPending={reorderBlogsMutation.isPending}
      />
    </article>
  );
}
