import { setup, assign } from "xstate";
import type { Location } from "./travelPlanMachine";
import type { Visibility } from "~/types/content";

export interface BlogMachineContext {
  title: string;
  description: string;
  visibility: Visibility;
  featuredImageUrl: string;
  selectedJournalId: string;
  selectedTagIds: string[];
  selectedLocations: Location[];
  locationSearchValue: string;
  locationSuggestions: any[];
  tagSearchQuery: string;
  error: string | null;
}

export type BlogMachineEvent =
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_VISIBILITY"; visibility: Visibility }
  | { type: "SET_FEATURED_IMAGE"; url: string }
  | { type: "REMOVE_FEATURED_IMAGE" }
  | { type: "SET_JOURNAL_ID"; journalId: string }
  | { type: "SET_LOCATION_SEARCH"; value: string }
  | { type: "SET_LOCATION_SUGGESTIONS"; suggestions: any[] }
  | { type: "ADD_LOCATION"; location: Location }
  | { type: "REMOVE_LOCATION"; locationId: string }
  | { type: "SET_TAG_SEARCH"; query: string }
  | { type: "TOGGLE_TAG"; tagId: string }
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_SUCCESS"; url: string }
  | { type: "UPLOAD_FAILURE"; error: string }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_FAILURE"; error: string }
  | { type: "LOAD_BLOG"; blogData: any };

export const blogMachine = setup({
  types: {
    context: {} as BlogMachineContext,
    events: {} as BlogMachineEvent,
  },
}).createMachine({
  id: "blog",
  initial: "idle",
  context: {
    title: "",
    description: "",
    visibility: "PRIVATE",
    featuredImageUrl: "",
    selectedJournalId: "",
    selectedTagIds: [],
    selectedLocations: [],
    locationSearchValue: "",
    locationSuggestions: [],
    tagSearchQuery: "",
    error: null,
  },
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
        SET_FEATURED_IMAGE: {
          actions: assign({ featuredImageUrl: ({ event }) => event.url }),
        },
        REMOVE_FEATURED_IMAGE: {
          actions: assign({ featuredImageUrl: "" }),
        },
        SET_JOURNAL_ID: {
          actions: assign({ selectedJournalId: ({ event }) => event.journalId }),
        },
        SET_LOCATION_SEARCH: {
          actions: assign({ locationSearchValue: ({ event }) => event.value }),
        },
        SET_LOCATION_SUGGESTIONS: {
          actions: assign({ locationSuggestions: ({ event }) => event.suggestions }),
        },
        ADD_LOCATION: {
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
        REMOVE_LOCATION: {
          actions: assign({
            selectedLocations: ({ context, event }) =>
              context.selectedLocations.filter((l) => l.id !== event.locationId),
          }),
        },
        SET_TAG_SEARCH: {
          actions: assign({ tagSearchQuery: ({ event }) => event.query }),
        },
        TOGGLE_TAG: {
          actions: assign({
            selectedTagIds: ({ context, event }) =>
              context.selectedTagIds.includes(event.tagId)
                ? context.selectedTagIds.filter((id) => id !== event.tagId)
                : [...context.selectedTagIds, event.tagId],
          }),
        },
        UPLOAD_START: {
          target: "uploading",
        },
        SUBMIT: {
          target: "saving",
        },
        LOAD_BLOG: {
          actions: assign(({ event }) => ({
            title: event.blogData.title,
            description: event.blogData.description,
            visibility: event.blogData.visibility,
            featuredImageUrl: event.blogData.featuredImageUrl || "",
            selectedJournalId: event.blogData.journalId || "",
            selectedTagIds: event.blogData.tags.map((t: any) => t.tagId),
            selectedLocations: event.blogData.locations.map((l: any) => l.location),
          })),
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
