import { setup, assign } from "xstate";
import type { Location } from "./travelPlanMachine";
import type { Visibility } from "~/types/content";

export interface BlogItem {
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

export interface JournalContext {
  title: string;
  description: string;
  visibility: Visibility;
  featuredImageUrl: string;
  selectedTagIds: string[];
  selectedLocations: Location[];
  blogsInJournal: BlogItem[];
  locationSearchValue: string;
  locationSuggestions: any[];
  tagSearchQuery: string;
  draggedBlogIndex: number | null;
  draggedOverBlogIndex: number | null;
  blogToSwap: BlogItem | null;
  swapPositionValue: number;
  dragPendingIndex: { from: number; to: number } | null;
  error: string | null;
}

export type JournalEvent =
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DESCRIPTION"; description: string }
  | { type: "SET_VISIBILITY"; visibility: Visibility }
  | { type: "SET_FEATURED_IMAGE"; url: string }
  | { type: "REMOVE_FEATURED_IMAGE" }
  | { type: "SET_LOCATION_SEARCH"; value: string }
  | { type: "SET_LOCATION_SUGGESTIONS"; suggestions: any[] }
  | { type: "ADD_LOCATION"; location: Location }
  | { type: "REMOVE_LOCATION"; locationId: string }
  | { type: "SET_TAG_SEARCH"; query: string }
  | { type: "TOGGLE_TAG"; tagId: string }
  | { type: "SET_BLOGS_IN_JOURNAL"; blogs: BlogItem[] }
  | { type: "ADD_BLOG_TO_JOURNAL"; blog: BlogItem }
  | { type: "REMOVE_BLOG_FROM_JOURNAL"; blogId: string }
  | { type: "SET_DRAG_START"; index: number }
  | { type: "SET_DRAG_OVER"; index: number | null }
  | { type: "INITIATE_SWAP"; blog: BlogItem; index: number }
  | { type: "SET_SWAP_POSITION_VALUE"; value: number }
  | { type: "INITIATE_DRAG_DROP"; from: number; to: number }
  | { type: "CONFIRM_REORDER"; newBlogs: BlogItem[] }
  | { type: "CANCEL_REORDER" }
  | { type: "UPLOAD_START" }
  | { type: "UPLOAD_SUCCESS"; url: string }
  | { type: "UPLOAD_FAILURE"; error: string }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_FAILURE"; error: string }
  | { type: "LOAD_JOURNAL"; journalData: any };

function extractLocationsAndTags(
  blogs: BlogItem[],
  currentLocations: Location[],
  currentTagIds: string[]
) {
  if (blogs.length === 0) return { selectedLocations: currentLocations, selectedTagIds: currentTagIds };

  // Locations Extraction
  const blogLocs = blogs.flatMap((b) => b.locations?.map((l: any) => l.location) ?? []);
  const uniqueBlogLocs = blogLocs.filter(
    (loc, index, self) => self.findIndex((l) => l.id === loc.id) === index
  );

  const selectedLocations = [...currentLocations];
  uniqueBlogLocs.forEach((loc) => {
    if (!selectedLocations.some((l) => l.id === loc.id)) {
      selectedLocations.push(loc);
    }
  });

  // Tags Extraction
  const blogTagIds = blogs.flatMap((b) => b.tags?.map((t: any) => t.tagId) ?? []);
  const uniqueBlogTagIds = Array.from(new Set(blogTagIds)) as string[];
  const selectedTagIds = Array.from(new Set([...currentTagIds, ...uniqueBlogTagIds]));

  return { selectedLocations, selectedTagIds };
}

export const journalMachine = setup({
  types: {
    context: {} as JournalContext,
    events: {} as JournalEvent,
  },
}).createMachine({
  id: "journal",
  initial: "idle",
  context: {
    title: "",
    description: "",
    visibility: "PRIVATE",
    featuredImageUrl: "",
    selectedTagIds: [],
    selectedLocations: [],
    blogsInJournal: [],
    locationSearchValue: "",
    locationSuggestions: [],
    tagSearchQuery: "",
    draggedBlogIndex: null,
    draggedOverBlogIndex: null,
    blogToSwap: null,
    swapPositionValue: 1,
    dragPendingIndex: null,
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
        SET_BLOGS_IN_JOURNAL: {
          actions: assign(({ context, event }) => {
            const { selectedLocations, selectedTagIds } = extractLocationsAndTags(
              event.blogs,
              context.selectedLocations,
              context.selectedTagIds
            );
            return {
              blogsInJournal: event.blogs,
              selectedLocations,
              selectedTagIds,
            };
          }),
        },
        ADD_BLOG_TO_JOURNAL: {
          actions: assign(({ context, event }) => {
            const nextBlogs = [...context.blogsInJournal, event.blog];
            const { selectedLocations, selectedTagIds } = extractLocationsAndTags(
              nextBlogs,
              context.selectedLocations,
              context.selectedTagIds
            );
            return {
              blogsInJournal: nextBlogs,
              selectedLocations,
              selectedTagIds,
            };
          }),
        },
        REMOVE_BLOG_FROM_JOURNAL: {
          actions: assign(({ context, event }) => {
            const nextBlogs = context.blogsInJournal.filter((b) => b.id !== event.blogId);
            const { selectedLocations, selectedTagIds } = extractLocationsAndTags(
              nextBlogs,
              context.selectedLocations,
              context.selectedTagIds
            );
            return {
              blogsInJournal: nextBlogs,
              selectedLocations,
              selectedTagIds,
            };
          }),
        },
        SET_DRAG_START: {
          actions: assign({ draggedBlogIndex: ({ event }) => event.index }),
        },
        SET_DRAG_OVER: {
          actions: assign({ draggedOverBlogIndex: ({ event }) => event.index }),
        },
        INITIATE_SWAP: {
          actions: assign({
            blogToSwap: ({ event }) => event.blog,
            swapPositionValue: ({ event }) => event.index + 1,
          }),
        },
        SET_SWAP_POSITION_VALUE: {
          actions: assign({ swapPositionValue: ({ event }) => event.value }),
        },
        INITIATE_DRAG_DROP: {
          target: "reordering",
          actions: assign({
            dragPendingIndex: ({ event }) => ({ from: event.from, to: event.to }),
          }),
        },
        UPLOAD_START: {
          target: "uploading",
        },
        SUBMIT: {
          target: "saving",
        },
        LOAD_JOURNAL: {
          actions: assign(({ event }) => ({
            title: event.journalData.title,
            description: event.journalData.description,
            visibility: event.journalData.visibility,
            featuredImageUrl: event.journalData.featuredImageUrl || "",
            selectedTagIds: event.journalData.tags.map((t: any) => t.tagId),
            selectedLocations: event.journalData.locations.map((l: any) => l.location),
            blogsInJournal: event.journalData.blogs || [],
          })),
        },
      },
    },
    reordering: {
      on: {
        CONFIRM_REORDER: {
          target: "idle",
          actions: assign(({ context, event }) => {
            const { selectedLocations, selectedTagIds } = extractLocationsAndTags(
              event.newBlogs,
              context.selectedLocations,
              context.selectedTagIds
            );
            return {
              blogsInJournal: event.newBlogs,
              selectedLocations,
              selectedTagIds,
              dragPendingIndex: null,
              draggedBlogIndex: null,
              draggedOverBlogIndex: null,
              blogToSwap: null,
            };
          }),
        },
        CANCEL_REORDER: {
          target: "idle",
          actions: assign({
            dragPendingIndex: null,
            draggedBlogIndex: null,
            draggedOverBlogIndex: null,
            blogToSwap: null,
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
