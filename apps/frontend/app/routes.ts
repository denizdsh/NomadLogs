import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("components/layout/AppLayout.tsx", [
    index("routes/home.tsx"),
    route("login", "routes/login.tsx"),
    route("auth/callback", "routes/auth.callback.tsx"),
    route("feed", "routes/feed.tsx"),
    route("explore", "routes/explore.tsx"),
    route("blog/new", "routes/blog.new.tsx"),
    route("blog/:slug", "routes/blog.$slug.tsx"),
    route("journal/new", "routes/journal.new.tsx"),
    route("journal/:slug", "routes/journal.$slug.tsx"),
    route("plan/new", "routes/plan.new.tsx"),
    route("plan/:slug", "routes/plan.$slug.tsx"),
    route("studio", "routes/studio.tsx"),
    route("chats", "routes/chats.tsx"),
    route("user/:username", "routes/user.$username.tsx"),
    layout("components/layout/DashboardLayout.tsx", [
      route("dashboard", "routes/dashboard.index.tsx"),
      route("dashboard/notifications", "routes/dashboard.notifications.tsx"),
      route("dashboard/settings", "routes/dashboard.settings.tsx"),
    ]),
    route("about", "routes/about.tsx"),
    route("terms", "routes/terms.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("*", "routes/$.tsx"),
  ]),
] satisfies RouteConfig;
