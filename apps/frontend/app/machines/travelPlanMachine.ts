import { setup, assign } from "xstate";
import type { Visibility, Season, TravelPlanBlockType } from "~/types/content";

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  osmId?: string | null;
  createdAt?: string | Date;
}

export interface LocationSuggestion {
  id: string | number;
  label: string;
  lat: number;
  lng: number;
}

export interface LocalBlock {
  id: string;
  type: TravelPlanBlockType;
  title: string;
  locations: Location[]; // Array of database Location objects
  tempLocationSearch: string;
  tempLocationSuggestions: LocationSuggestion[];
}

export interface LoadedPlanData {
  title: string;
  description: string;
  visibility: Visibility;
  season: Season;
  featuredImageUrl?: string | null;
  tags?: { tagId: string }[];
  locations?: { location: Location }[];
  blocks?: {
    id: string;
    type: TravelPlanBlockType;
    title: string;
    locations?: { location: Location }[];
  }[];
}

export interface TravelPlanContext {
  title: string;
  description: string;
  visibility: Visibility;
  season: Season;
  featuredImageUrl: string;
  selectedTagIds: string[];
  selectedLocations: Location[];
  blocks: LocalBlock[];
  showBlockTooltip: boolean;
  locationSearchValue: string;
  locationSuggestions: LocationSuggestion[];
  tagSearchQuery: string;
  error: string | null;
  draggedFromIndex: number | null;
  draggedToIndex: number | null;
}

export type TravelPlanEvent =
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_VISIBILITY"; visibility: Visibility }
  | { type: "SET_SEASON"; season: Season }
  | { type: "SET_FEATURED_IMAGE"; url: string }
  | { type: "REMOVE_FEATURED_IMAGE" }
  | { type: "SET_TAG_SEARCH"; query: string }
  | { type: "TOGGLE_TAG"; tagId: string }
  | { type: "SET_LOCATION_SEARCH"; value: string }
  | { type: "SET_LOCATION_SUGGESTIONS"; suggestions: LocationSuggestion[] }
  | { type: "ADD_PLAN_LOCATION"; location: Location }
  | { type: "REMOVE_PLAN_LOCATION"; locationId: string }
  | { type: "SET_BLOCK_LOCATION_SEARCH"; blockId: string; value: string }
  | { type: "SET_BLOCK_LOCATION_SUGGESTIONS"; blockId: string; suggestions: LocationSuggestion[] }
  | { type: "ADD_BLOCK_LOCATION"; blockId: string; location: Location }
  | { type: "REMOVE_BLOCK_LOCATION"; blockId: string; locationId: string }
  | { type: "SET_BLOCK_TITLE"; blockId: string; title: string }
  | { type: "ADD_DAY" }
  | { type: "ADD_CUSTOM_BLOCK"; title: string }
  | { type: "REMOVE_BLOCK"; blockId: string }
  | { type: "TOGGLE_BLOCK_TOOLTIP"; show?: boolean }
  | { type: "INITIATE_REORDER"; fromIndex: number; toIndex: number }
  | { type: "CONFIRM_REORDER" }
  | { type: "CANCEL_REORDER" }
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_SUCCESS"; url: string }
  | { type: "UPLOAD_FAILURE"; error: string }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_FAILURE"; error: string }
  | { type: "LOAD_PLAN"; planData: LoadedPlanData };

export const travelPlanMachine = setup({
  types: {
    context: {} as TravelPlanContext,
    events: {} as TravelPlanEvent,
  },
}).createMachine({
  id: "travelPlan",
  initial: "idle",
  context: {
    title: "",
    description: "",
    visibility: "PRIVATE",
    season: "ALL",
    featuredImageUrl: "",
    selectedTagIds: [],
    selectedLocations: [],
    blocks: [
      {
        id: "block-1",
        type: "DAY",
        title: "Day 1: Arrival & Exploration",
        locations: [],
        tempLocationSearch: "",
        tempLocationSuggestions: [],
      },
    ],
    showBlockTooltip: false,
    locationSearchValue: "",
    locationSuggestions: [],
    tagSearchQuery: "",
    error: null,
    draggedFromIndex: null,
    draggedToIndex: null,
  } as TravelPlanContext,
  states: {
    idle: {
      on: {
        SET_TITLE: {
          actions: assign({ title: ({ event }) => event.title }),
        },
        SET_DESCRIPTION: {
          actions: assign({ description: ({ event }) => event.description }),
        },
        SET_VISIBILITY: {
          actions: assign({ visibility: ({ event }) => event.visibility }),
        },
        SET_SEASON: {
          actions: assign({ season: ({ event }) => event.season }),
        },
        SET_FEATURED_IMAGE: {
          actions: assign({ featuredImageUrl: ({ event }) => event.url }),
        },
        REMOVE_FEATURED_IMAGE: {
          actions: assign({ featuredImageUrl: "" }),
        },
        SET_TAG_SEARCH: {
          actions: assign({ tagSearchQuery: ({ event }) => event.query }),
        },
        TOGGLE_TAG: {
          actions: assign({
            selectedTagIds: ({ context, event }) => {
              const { selectedTagIds } = context;
              return selectedTagIds.includes(event.tagId)
                ? selectedTagIds.filter((id) => id !== event.tagId)
                : [...selectedTagIds, event.tagId];
            },
          }),
        },
        SET_LOCATION_SEARCH: {
          actions: assign({ locationSearchValue: ({ event }) => event.value }),
        },
        SET_LOCATION_SUGGESTIONS: {
          actions: assign({ locationSuggestions: ({ event }) => event.suggestions }),
        },
        ADD_PLAN_LOCATION: {
          actions: assign({
            selectedLocations: ({ context, event }) => {
              if (context.selectedLocations.some((l) => l.id === event.location.id)) {
                return context.selectedLocations;
              }
              return [...context.selectedLocations, event.location];
            },
            locationSearchValue: "",
            locationSuggestions: [],
          }),
        },
        REMOVE_PLAN_LOCATION: {
          actions: assign({
            selectedLocations: ({ context, event }) =>
              context.selectedLocations.filter((l) => l.id !== event.locationId),
          }),
        },
        SET_BLOCK_LOCATION_SEARCH: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.map((b) =>
                b.id === event.blockId ? { ...b, tempLocationSearch: event.value } : b
              ),
          }),
        },
        SET_BLOCK_LOCATION_SUGGESTIONS: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.map((b) =>
                b.id === event.blockId ? { ...b, tempLocationSuggestions: event.suggestions } : b
              ),
          }),
        },
        ADD_BLOCK_LOCATION: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.map((b) => {
                if (b.id === event.blockId) {
                  const list = b.locations.some((l) => l.id === event.location.id)
                    ? b.locations
                    : [...b.locations, event.location];
                  return {
                    ...b,
                    locations: list,
                    tempLocationSearch: "",
                    tempLocationSuggestions: [],
                  };
                }
                return b;
              }),
          }),
        },
        REMOVE_BLOCK_LOCATION: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.map((b) =>
                b.id === event.blockId
                  ? { ...b, locations: b.locations.filter((l) => l.id !== event.locationId) }
                  : b
              ),
          }),
        },
        SET_BLOCK_TITLE: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.map((b) =>
                b.id === event.blockId ? { ...b, title: event.title } : b
              ),
          }),
        },
        ADD_DAY: {
          actions: assign({
            blocks: ({ context }) => {
              const nextDay = context.blocks.filter((b) => b.type === "DAY").length + 1;
              return [
                ...context.blocks,
                {
                  id: `block-${Date.now()}`,
                  type: "DAY",
                  title: `Day ${nextDay}: New Day`,
                  locations: [],
                  tempLocationSearch: "",
                  tempLocationSuggestions: [],
                },
              ];
            },
          }),
        },
        ADD_CUSTOM_BLOCK: {
          actions: assign({
            blocks: ({ context, event }) => [
              ...context.blocks,
              {
                id: `block-${Date.now()}`,
                type: "CUSTOM",
                title: event.title,
                locations: [],
                tempLocationSearch: "",
                tempLocationSuggestions: [],
              },
            ],
            showBlockTooltip: false,
          }),
        },
        REMOVE_BLOCK: {
          actions: assign({
            blocks: ({ context, event }) =>
              context.blocks.filter((b) => b.id !== event.blockId),
          }),
        },
        TOGGLE_BLOCK_TOOLTIP: {
          actions: assign({
            showBlockTooltip: ({ context, event }) =>
              event.show !== undefined ? event.show : !context.showBlockTooltip,
          }),
        },
        INITIATE_REORDER: {
          target: "confirmReordering",
          actions: assign({
            draggedFromIndex: ({ event }) => event.fromIndex,
            draggedToIndex: ({ event }) => event.toIndex,
          }),
        },
        UPLOAD_START: {
          target: "uploading",
        },
        SUBMIT: {
          target: "saving",
        },
        LOAD_PLAN: {
          actions: assign(({ event }) => ({
            title: event.planData.title,
            description: event.planData.description,
            visibility: event.planData.visibility,
            season: event.planData.season,
            featuredImageUrl: event.planData.featuredImageUrl || "",
            selectedTagIds: event.planData.tags?.map((t) => t.tagId) || [],
            selectedLocations: event.planData.locations?.map((l) => l.location) || [],
            blocks: event.planData.blocks?.map((b) => ({
              id: b.id,
              type: b.type,
              title: b.title,
              locations: b.locations?.map((l) => l.location) || [],
              tempLocationSearch: "",
              tempLocationSuggestions: [],
            })) || [],
          })),
        },
      },
    },
    confirmReordering: {
      on: {
        CONFIRM_REORDER: {
          target: "idle",
          actions: assign({
            blocks: ({ context }) => {
              const { blocks, draggedFromIndex, draggedToIndex } = context;
              if (draggedFromIndex === null || draggedToIndex === null) return blocks;

              const list = [...blocks];
              const [moved] = list.splice(draggedFromIndex, 1);
              list.splice(draggedToIndex, 0, moved!);

              // Recalculate day numbers
              let dayCount = 1;
              return list.map((b) => {
                if (b.type === "DAY") {
                  const updated = { ...b, title: b.title.startsWith("Day ") ? b.title.replace(/^Day \d+/, `Day ${dayCount}`) : `Day ${dayCount}: ${b.title}` };
                  dayCount++;
                  return updated;
                }
                return b;
              });
            },
            draggedFromIndex: null,
            draggedToIndex: null,
          }),
        },
        CANCEL_REORDER: {
          target: "idle",
          actions: assign({
            draggedFromIndex: null,
            draggedToIndex: null,
          }),
        },
      },
    },
    uploading: {
      on: {
        UPLOAD_SUCCESS: {
          target: "idle",
          actions: assign({
            featuredImageUrl: ({ event }) => event.url,
            error: null,
          }),
        },
        UPLOAD_FAILURE: {
          target: "idle",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    saving: {
      on: {
        SUBMIT_SUCCESS: {
          target: "idle",
          actions: assign({
            error: null,
          }),
        },
        SUBMIT_FAILURE: {
          target: "idle",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
  },
});
