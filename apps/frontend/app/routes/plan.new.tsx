import { useState, Suspense, lazy, useEffect, useRef } from "react";
import {
  Upload,
  ImagePlus,
  Plus,
  Calendar,
  Trash2,
  GripVertical,
} from "lucide-react";
import { SplitPane } from "~/components/layout/SplitPane";
import { Button } from "~/components/ui/Button";
import { Tag as UTag } from "~/components/ui/Tag";
import { SearchBar } from "~/components/ui/SearchBar";
import { trpc, type RouterOutputs } from "~/utils/trpc";
import { uploadImage } from "~/utils/upload";
import { useToast } from "~/providers/ToastProvider";
import { useNavigate, useSearchParams } from "react-router";
import { useMachine } from "@xstate/react";
import { travelPlanMachine } from "~/machines/travelPlanMachine";
import { Modal } from "~/components/ui/Modal";
import type { Visibility, Season } from "~/types/content";
import { VISIBILITIES, SEASONS, BLOCK_TYPES } from "~/constants/content";
import { ROUTES } from "~/constants/routes";
import { MACHINE_STATES } from "~/constants/machine";
import { searchLocation } from "~/utils/geocoding";
import type { LocationSuggestion } from "~/utils/geocoding";
import { RichEditor } from "~/components/ui/RichEditor";

type PlanDetailType = NonNullable<RouterOutputs["travelPlan"]["getBySlug"]>;

const MapView = lazy(() =>
  import("~/components/map/MapView").then((m) => ({ default: m.MapView })),
);

export function meta() {
  return [
    { title: "Plan a Trip — NomadLogs" },
    {
      name: "description",
      content: "Create a structured day-by-day travel plan itinerary.",
    },
  ];
}

const PREDEFINED_BLOCKS = [
  { label: "🍽️ Food & Dining", heading: "Food & Dining Notes" },
  { label: "🛏️ Accommodation", heading: "Accommodation Info" },
  { label: "🗺️ Sightseeing", heading: "Sightseeing Spots" },
  { label: "🏛️ Museums", heading: "Museums & Cultural Sites" },
  { label: "🛍️ Shopping", heading: "Shopping Locations" },
  { label: "🎭 Entertainment", heading: "Entertainment & Nightlife" },
];

export default function PlanNew() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();
  const editSlug = searchParams.get("edit");

  // Fetch tags
  const { data: dbTags } = trpc.tag.listTags.useQuery({ limit: 100 });

  // Fetch plan if in edit mode
  const { data: editPlanData, isLoading: isEditLoading } =
    trpc.travelPlan.getBySlug.useQuery(
      { slug: editSlug || "" },
      { enabled: !!editSlug },
    );
  const editPlan = editPlanData as PlanDetailType | undefined;

  // Initialize machine
  const [state, send] = useMachine(travelPlanMachine);

  // Context destructuring
  const {
    title,
    description,
    visibility,
    season,
    featuredImageUrl,
    selectedTagIds,
    selectedLocations,
    blocks,
    showBlockTooltip,
    locationSearchValue,
    locationSuggestions,
    tagSearchQuery,
  } = state.context;

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const editorInstancesRef = useRef<Record<string, any>>({});

  // Mutations
  const upsertLocationMutation = trpc.tag.upsertLocation.useMutation();
  const createPlanMutation = trpc.travelPlan.create.useMutation();
  const updatePlanMutation = trpc.travelPlan.update.useMutation();
  const addBlockMutation = trpc.travelPlan.addBlock.useMutation();
  const updateBlockMutation = trpc.travelPlan.updateBlock.useMutation();
  const deleteBlockMutation = trpc.travelPlan.deleteBlock.useMutation();
  const reorderBlocksMutation = trpc.travelPlan.reorderBlocks.useMutation();

  // Populate edit plan data if edit mode
  useEffect(() => {
    if (editPlan) {
      send({ type: "LOAD_PLAN", planData: editPlan });
    }
  }, [editPlan, send]);

  // Plan-wide location query Nominatim geocoder suggestions
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

  const handleSelectPlanLocation = async (suggestion: LocationSuggestion) => {
    try {
      const result = await upsertLocationMutation.mutateAsync({
        name: suggestion.label.split(",")[0] || suggestion.label,
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        osmId: String(suggestion.id),
      });
      send({ type: "ADD_PLAN_LOCATION", location: result });
    } catch (err) {
      toast("Failed to add location.", "error");
    }
  };

  const handleBlockLocationSearch = async (blockId: string, val: string) => {
    send({ type: "SET_BLOCK_LOCATION_SEARCH", blockId, value: val });
    if (val.trim().length < 3) {
      send({
        type: "SET_BLOCK_LOCATION_SUGGESTIONS",
        blockId,
        suggestions: [],
      });
      return;
    }
    try {
      const items = await searchLocation(val);
      send({
        type: "SET_BLOCK_LOCATION_SUGGESTIONS",
        blockId,
        suggestions: items,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectBlockLocation = async (
    blockId: string,
    suggestion: LocationSuggestion,
  ) => {
    try {
      const result = await upsertLocationMutation.mutateAsync({
        name: suggestion.label.split(",")[0] || suggestion.label,
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        osmId: String(suggestion.id),
      });
      send({ type: "ADD_BLOCK_LOCATION", blockId, location: result });
    } catch (err) {
      toast("Failed to add block location.", "error");
    }
  };

  const handleRemoveBlockLocation = (blockId: string, locationId: string) => {
    send({ type: "REMOVE_BLOCK_LOCATION", blockId, locationId });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    send({ type: "UPLOAD_START" });
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      send({ type: "UPLOAD_SUCCESS", url });
      toast("Image uploaded successfully!", "success");
    } catch (err: any) {
      send({ type: "UPLOAD_FAILURE", error: err.message });
      toast(err.message || "Failed to upload image.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast("Please enter a title.", "warning");

    send({ type: "SUBMIT" });
    try {
      let finalPlanSlug = editSlug || "";

      if (editSlug && editPlan) {
        // 1. Update metadata
        await updatePlanMutation.mutateAsync({
          travelPlanId: editPlan.id,
          title,
          description: description || title,
          featuredImageUrl: featuredImageUrl || undefined,
          season,
          tagIds: selectedTagIds,
          locationIds: selectedLocations.map((l) => l.id),
        });

        // 2. Identify deleted blocks & delete them
        const dbBlockIds = editPlan.blocks.map((b) => b.id);
        const currentBlockIds = blocks.map((b) => b.id);
        const deletedBlockIds = dbBlockIds.filter(
          (id) => !currentBlockIds.includes(id),
        );
        for (const blockId of deletedBlockIds) {
          await deleteBlockMutation.mutateAsync({ blockId });
        }

        // 3. Add or update blocks
        const finalBlockIds: string[] = [];
        for (const block of blocks) {
          let contentData = { blocks: [] };
          const editor = editorInstancesRef.current[block.id];
          if (editor && typeof editor.save === "function") {
            try {
              contentData = await editor.save();
            } catch (err) {
              console.error(err);
            }
          }

          if (block.id.startsWith("block-")) {
            const createdBlock = await addBlockMutation.mutateAsync({
              travelPlanId: editPlan.id,
              type: block.type,
              title: block.title,
              content: contentData,
              locations: block.locations.map((loc, idx) => ({
                locationId: loc.id,
                order: idx,
              })),
            });
            finalBlockIds.push(createdBlock.id);
          } else {
            await updateBlockMutation.mutateAsync({
              blockId: block.id,
              title: block.title,
              content: contentData,
              locations: block.locations.map((loc, idx) => ({
                locationId: loc.id,
                order: idx,
              })),
            });
            finalBlockIds.push(block.id);
          }
        }

        // 4. Reorder blocks in database sequence
        await reorderBlocksMutation.mutateAsync({
          travelPlanId: editPlan.id,
          blockIds: finalBlockIds,
        });

        toast("Travel plan updated successfully!", "success");
      } else {
        // Create new plan metadata
        const planResult = await createPlanMutation.mutateAsync({
          title,
          description: description || title,
          featuredImageUrl: featuredImageUrl || undefined,
          season,
          visibility,
          tagIds: selectedTagIds,
          locationIds: selectedLocations.map((l) => l.id),
        });

        finalPlanSlug = planResult.slug;

        // Create new blocks
        for (const block of blocks) {
          let contentData = { blocks: [] };
          const editor = editorInstancesRef.current[block.id];
          if (editor && typeof editor.save === "function") {
            try {
              contentData = await editor.save();
            } catch (err) {
              console.error(err);
            }
          }

          await addBlockMutation.mutateAsync({
            travelPlanId: planResult.id,
            type: block.type,
            title: block.title,
            content: contentData,
            locations: block.locations.map((loc, idx) => ({
              locationId: loc.id,
              order: idx,
            })),
          });
        }

        toast("Travel plan created successfully!", "success");
      }

      send({ type: "SUBMIT_SUCCESS" });
      utils.explore.list.invalidate();
      if (editSlug) {
        utils.travelPlan.getBySlug.invalidate({ slug: editSlug });
      }
      navigate(ROUTES.PLAN.DETAIL(finalPlanSlug));
    } catch (err) {
      console.error(err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save travel plan.";
      send({ type: "SUBMIT_FAILURE", error: errMsg });
      toast(errMsg, "error");
    }
  };

  // Drag-and-drop ordering triggers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    send({ type: "INITIATE_REORDER", fromIndex: draggedIdx, toIndex: index });
    setDraggedIdx(null);
  };

  if (isEditLoading) {
    return (
      <div className="p-8 text-center text-body-lg skeleton-shimmer">
        Loading existing travel plan...
      </div>
    );
  }

  const mapPins = [
    ...selectedLocations.map((loc) => ({ ...loc, label: loc.name })),
    ...blocks.flatMap((b) =>
      b.locations.map((loc) => ({
        ...loc,
        label: `${b.type === BLOCK_TYPES.DAY ? "Day: " : ""}${loc.name}`,
      })),
    ),
  ].map((loc) => ({
    id: loc.id,
    lat: loc.latitude,
    lng: loc.longitude,
    label: loc.label,
    color: "#3B7197",
  }));

  const leftContent = (
    <section className="p-6 space-y-8 pb-20">
      {/* Plan Details Form */}
      <section className="rounded-2xl bg-surface border border-border-custom p-6 space-y-5">
        <h1 className="text-headline-lg text-on-surface">
          {editSlug ? "Edit Travel Plan" : "Plan a Trip"}
        </h1>

        {/* Thumbnail */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface font-semibold">
            Featured Image
          </legend>
          {featuredImageUrl ? (
            <figure className="relative h-48 rounded-xl overflow-hidden border border-border-custom bg-neutral">
              <img
                src={featuredImageUrl}
                alt="Featured Preview"
                className="w-full h-full object-cover"
              />
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
              <ImagePlus
                size={32}
                className="text-on-surface-muted mb-2 animate-pulse"
              />
              <span className="text-body-sm text-on-surface-muted">
                {isUploading
                  ? "Uploading..."
                  : "Click to upload featured image"}
              </span>
              <input
                id="featured-image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          )}
        </fieldset>

        {/* Title */}
        <fieldset className="space-y-1">
          <legend className="text-label-lg text-on-surface font-semibold">
            Title
          </legend>
          <input
            type="text"
            value={title}
            onChange={(e) => send({ type: "SET_TITLE", title: e.target.value })}
            placeholder="Give your plan a title..."
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-lg focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-serif"
          />
        </fieldset>

        {/* Locations */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface font-semibold">
            Plan-wide Locations
          </legend>
          <SearchBar
            placeholder="Search locations..."
            value={locationSearchValue}
            onChange={(val) =>
              send({ type: "SET_LOCATION_SEARCH", value: val })
            }
            suggestions={locationSuggestions}
            onSuggestionSelect={handleSelectPlanLocation}
            onSubmit={() => {}}
            forceSelection={true}
            size="sm"
          />
          {selectedLocations.length > 0 && (
            <nav
              className="flex flex-wrap gap-1.5"
              aria-label="Selected locations"
            >
              {selectedLocations.map((loc) => (
                <UTag
                  key={loc.id}
                  label={loc.name}
                  variant="location"
                  isRemovable
                  onRemove={() =>
                    send({ type: "REMOVE_PLAN_LOCATION", locationId: loc.id })
                  }
                  size="sm"
                />
              ))}
            </nav>
          )}
        </fieldset>

        {/* Tags */}
        <fieldset className="space-y-2">
          <legend className="text-label-lg text-on-surface font-semibold">
            Tags
          </legend>
          <input
            type="text"
            placeholder="Filter tags..."
            value={tagSearchQuery}
            onChange={(e) =>
              send({ type: "SET_TAG_SEARCH", query: e.target.value })
            }
            className="w-full rounded-xl bg-neutral border border-border-custom px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <ul className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {dbTags
              ?.filter((tag) =>
                tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()),
              )
              .map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <li key={tag.id}>
                    <UTag
                      label={tag.name}
                      isActive={isSelected}
                      onToggle={() =>
                        send({ type: "TOGGLE_TAG", tagId: tag.id })
                      }
                      size="sm"
                    />
                  </li>
                );
              })}
          </ul>
        </fieldset>

        {/* Season & Visibility */}
        <fieldset className="grid grid-cols-2 gap-4">
          <section className="space-y-1">
            <legend className="text-label-lg text-on-surface font-semibold">
              Season
            </legend>
            <select
              value={season}
              onChange={(e) =>
                send({ type: "SET_SEASON", season: e.target.value as any })
              }
              className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            >
              <option value={SEASONS.ALL}>All Seasons</option>
              <option value={SEASONS.SPRING}>Spring</option>
              <option value={SEASONS.SUMMER}>Summer</option>
              <option value={SEASONS.AUTUMN}>Autumn</option>
              <option value={SEASONS.WINTER}>Winter</option>
              <option value={SEASONS.WARM_SEASONS}>Warm Seasons</option>
              <option value={SEASONS.COLD_SEASONS}>Cold Seasons</option>
            </select>
          </section>

          <section className="space-y-1">
            <legend className="text-label-lg text-on-surface font-semibold">
              Visibility
            </legend>
            <select
              value={visibility}
              onChange={(e) =>
                send({
                  type: "SET_VISIBILITY",
                  visibility: e.target.value as any,
                })
              }
              className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            >
              <option value={VISIBILITIES.PRIVATE}>Private</option>
              <option value={VISIBILITIES.UNLISTED}>Unlisted</option>
              <option value={VISIBILITIES.PUBLIC}>Public</option>
            </select>
          </section>
        </fieldset>

        {/* Description Summary */}
        <fieldset className="space-y-1">
          <legend className="text-label-lg text-on-surface font-semibold">
            Description Summary
          </legend>
          <textarea
            value={description}
            onChange={(e) =>
              send({ type: "SET_DESCRIPTION", description: e.target.value })
            }
            placeholder="Describe your travel plan..."
            rows={3}
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface px-4 py-3 text-body-md resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
        </fieldset>

        <Button
          variant="primary"
          size="lg"
          className="w-full animate-pulse-subtle"
          onClick={handleSubmit}
          disabled={state.matches(MACHINE_STATES.SAVING)}
        >
          <Upload size={16} />
          {state.matches(MACHINE_STATES.SAVING)
            ? "Saving Plan..."
            : visibility === VISIBILITIES.PRIVATE
              ? "Save Draft"
              : "Publish & Request Verification"}
        </Button>
      </section>

      {/* Dynamic Blocks list */}
      <section className="space-y-6">
        {blocks.map((block, index) => (
          <article
            key={block.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="rounded-2xl bg-surface border border-border-custom p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow relative cursor-grab active:cursor-grabbing group"
          >
            {/* Drag Handle UI Icon */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={18} />
            </div>

            <header className="flex items-center justify-between gap-4 pl-4">
              <h2 className="text-headline-md text-on-surface font-serif">
                {block.type === BLOCK_TYPES.DAY
                  ? `Day Block (${index + 1})`
                  : `Custom Block: ${block.title}`}
              </h2>
              <button
                type="button"
                onClick={() =>
                  send({ type: "REMOVE_BLOCK", blockId: block.id })
                }
                className="p-1.5 text-on-surface-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                aria-label="Delete block"
              >
                <Trash2 size={16} />
              </button>
            </header>

            <fieldset className="space-y-1 pl-4">
              <legend className="text-label-sm text-on-surface-muted font-semibold">
                Block Heading
              </legend>
              <input
                type="text"
                value={block.title}
                onChange={(e) =>
                  send({
                    type: "SET_BLOCK_TITLE",
                    blockId: block.id,
                    title: e.target.value,
                  })
                }
                className="w-full rounded-lg bg-neutral border border-border-custom text-on-surface px-3 py-2 text-body-sm focus:border-primary focus:ring-1"
              />
            </fieldset>

            {/* Block specific locations */}
            <fieldset className="space-y-2 pl-4">
              <legend className="text-label-sm text-on-surface-muted font-semibold font-sans">
                Block Locations
              </legend>
              <SearchBar
                placeholder="Search block locations..."
                value={block.tempLocationSearch}
                onChange={(val) => handleBlockLocationSearch(block.id, val)}
                suggestions={block.tempLocationSuggestions}
                onSuggestionSelect={(sug) =>
                  handleSelectBlockLocation(block.id, sug)
                }
                onSubmit={() => {}}
                forceSelection={true}
                size="sm"
              />
              {block.locations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {block.locations.map((loc) => (
                    <UTag
                      key={loc.id}
                      label={loc.name}
                      variant="location"
                      isRemovable
                      onRemove={() =>
                        handleRemoveBlockLocation(block.id, loc.id)
                      }
                      size="sm"
                    />
                  ))}
                </div>
              )}
            </fieldset>

            {!isEditLoading && (
              <RichEditor
                id={`editorjs-container-${block.id}`}
                placeholder={`Enter details for ${block.title}...`}
                data={
                  editPlan?.blocks?.find((b: any) => b.id === block.id)
                    ?.content || { blocks: [] }
                }
                onInitialize={(editorInstance) => {
                  editorInstancesRef.current[block.id] = editorInstance;
                }}
                onDestroy={() => {
                  delete editorInstancesRef.current[block.id];
                }}
                className="min-h-[200px] rounded-xl border border-dashed border-border-custom p-4 bg-neutral/10 ml-4"
              />
            )}
          </article>
        ))}
      </section>

      {/* Add Day / Add Custom Block Buttons */}
      <footer className="flex items-center gap-3 pl-4">
        <Button variant="secondary" onClick={() => send({ type: "ADD_DAY" })}>
          <Calendar size={14} /> Add Day
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => send({ type: "TOGGLE_BLOCK_TOOLTIP" })}
          >
            <Plus size={14} /> Add Custom Block
          </Button>
          {showBlockTooltip && (
            <menu className="absolute bottom-full left-0 mb-2 z-40 min-w-48 rounded-xl bg-surface border border-border-custom shadow-xl py-1.5 animate-slide-down">
              {PREDEFINED_BLOCKS.map((preset) => (
                <li key={preset.label}>
                  <button
                    type="button"
                    onClick={() =>
                      send({ type: "ADD_CUSTOM_BLOCK", title: preset.heading })
                    }
                    className="w-full text-left px-4 py-2 text-body-sm text-on-surface hover:bg-border-custom/50 transition-colors"
                  >
                    {preset.label}
                  </button>
                </li>
              ))}
            </menu>
          )}
        </div>
      </footer>

      {/* Confirmation Modal for Block Reordering */}
      <Modal
        isOpen={state.matches(MACHINE_STATES.CONFIRM_REORDERING)}
        onClose={() => send({ type: "CANCEL_REORDER" })}
        title="Confirm Block Reordering"
        confirmLabel="Confirm Reorder"
        onConfirm={() => send({ type: "CONFIRM_REORDER" })}
      >
        <p className="text-body-md text-on-surface">
          Are you sure you want to change the order of these itinerary blocks?
          Day numbers and routes will be automatically updated.
        </p>
      </Modal>
    </section>
  );

  const rightContent = (
    <section className="h-full p-4">
      <Suspense
        fallback={<section className="w-full h-full skeleton rounded-2xl" />}
      >
        {mapPins.length > 0 ? (
          <MapView
            pins={mapPins}
            paths={[
              {
                positions: mapPins.map(
                  (p: any) => [p.lat, p.lng] as [number, number],
                ),
                color: "#3B7197",
              },
            ]}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-on-surface-muted italic">
            Add locations to visualize path.
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
        initialLeftPercent={60}
        minLeftPercent={40}
        maxLeftPercent={100}
        className="h-full"
      />
    </article>
  );
}
