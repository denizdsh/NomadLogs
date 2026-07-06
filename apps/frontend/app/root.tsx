import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

import { STORAGE_KEYS } from "~/constants/storage";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1A4D3E" />
        <Meta />
        <Links />
        {/* Inline script to prevent theme flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('${STORAGE_KEYS.THEME}');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

import { ROUTES } from "~/constants/routes";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404 — Page Not Found" : `Error ${error.status}`;
    details =
      error.status === 404
        ? "The page you're looking for doesn't exist or may have been moved."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center animate-fade-in">
      <span className="text-6xl mb-6">🧭</span>
      <h1 className="text-headline-display text-on-surface mb-3">{message}</h1>
      <p className="text-body-lg text-on-surface-muted max-w-md mb-8">{details}</p>
      <Link
        to={ROUTES.HOME}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-neutral font-semibold text-label-lg transition-colors hover:bg-secondary"
      >
        Back to Home
      </Link>
      {stack && (
        <pre className="mt-8 w-full max-w-3xl p-4 overflow-x-auto text-left text-sm rounded-xl bg-surface border border-border-custom">
          <code className="text-on-surface-muted">{stack}</code>
        </pre>
      )}
    </main>
  );
}
