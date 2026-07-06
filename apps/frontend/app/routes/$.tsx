import { redirect, Navigate, type LoaderFunctionArgs } from "react-router";
import { ROUTES } from "~/constants/routes";

// Helper to resolve paths to the correct frontend routes
export function getRedirectPath(pathname: string): string {
  const blogMatch = pathname.match(/^\/blogs\/(.+)$/);
  if (blogMatch) {
    return ROUTES.BLOG.DETAIL(blogMatch[1]);
  }

  const journalMatch = pathname.match(/^\/journals\/(.+)$/);
  if (journalMatch) {
    return ROUTES.JOURNAL.DETAIL(journalMatch[1]);
  }

  const planMatch = pathname.match(/^\/travel-plans\/(.+)$/);
  if (planMatch) {
    return ROUTES.PLAN.DETAIL(planMatch[1]);
  }

  const chatMatch = pathname.match(/^\/chats\/(.+)$/);
  if (chatMatch) {
    return `${ROUTES.CHATS}?chatId=${chatMatch[1]}`;
  }

  return ROUTES.HOME;
}

// Catch-all route: handles unknown routes or legacy URL patterns
export function clientLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(getRedirectPath(url.pathname));
}

export default function CatchAll() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return <Navigate to={getRedirectPath(path)} replace />;
}
