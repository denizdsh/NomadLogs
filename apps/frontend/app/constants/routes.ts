export const ROUTES = {
  HOME: "/",
  EXPLORE: "/explore",
  STUDIO: "/studio",
  CHATS: "/chats",
  FEED: "/feed",
  DASHBOARD: {
    INDEX: "/dashboard",
    NOTIFICATIONS: "/dashboard/notifications",
    SETTINGS: "/dashboard/settings",
  },
  LOGIN: "/login",
  ABOUT: "/about",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  JOURNAL: {
    NEW: "/journal/new",
    DETAIL: (slug: string) => `/journal/${slug}`,
  },
  BLOG: {
    NEW: "/blog/new",
    DETAIL: (slug: string) => `/blog/${slug}`,
  },
  PLAN: {
    NEW: "/plan/new",
    DETAIL: (slug: string) => `/plan/${slug}`,
  },
  USER: {
    DETAIL: (username: string) => `/user/${username}`,
  },
} as const;
