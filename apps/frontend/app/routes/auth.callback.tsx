/**
 * OAuth callback route.
 *
 * This page receives the JWT token from the backend OAuth redirect
 * (via URL hash fragment), persists it in localStorage, and redirects
 * the user to the dashboard.
 *
 * URL pattern: /auth/callback#token=<jwt>
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "~/providers/AuthProvider";
import { useToast } from "~/providers/ToastProvider";
import { ROUTES } from "~/constants/routes";
import { STORAGE_KEYS } from "~/constants/storage";
import { Logo } from "~/components/ui/Logo";

export function meta() {
  return [
    { title: "Authenticating — NomadLogs" },
    {
      name: "description",
      content: "Completing your sign-in to NomadLogs.",
    },
  ];
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetchSession } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const processCallback = async () => {
      // Check for error from the query string (backend redirects errors there)
      const error = searchParams.get("error");
      if (error) {
        setStatus("error");
        setErrorMessage(decodeURIComponent(error));
        toast(decodeURIComponent(error), "error");
        return;
      }

      // Extract token from hash fragment: #token=<jwt>
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const token = hashParams.get("token");

      if (!token) {
        setStatus("error");
        setErrorMessage("No authentication token received. Please try again.");
        toast("Authentication failed. No token received.", "error");
        return;
      }

      // Persist the token
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);

      // Clean the hash from the URL
      window.history.replaceState(null, "", window.location.pathname);

      // Refetch the session to populate auth context
      try {
        await refetchSession();
        toast("Successfully signed in!", "success");
        navigate(ROUTES.DASHBOARD.INDEX, { replace: true });
      } catch (err) {
        console.error("Session fetch failed:", err);
        setStatus("error");
        setErrorMessage("Failed to load your profile. Please try again.");
        toast("Failed to load your profile.", "error");
      }
    };

    processCallback();
  }, []);

  if (status === "error") {
    return (
      <article className="flex items-center justify-center min-h-[calc(100vh-140px)] px-6 py-12 animate-fade-in">
        <section className="w-full max-w-md text-center space-y-6">
          <span className="text-5xl block" role="img" aria-label="Error">⚠️</span>
          <h1 className="text-headline-lg text-on-surface">
            Authentication Failed
          </h1>
          <p className="text-body-md text-on-surface-muted">
            {errorMessage}
          </p>
          <a
            href={ROUTES.LOGIN}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-neutral font-semibold text-label-lg transition-all hover:bg-secondary"
          >
            Back to Login
          </a>
        </section>
      </article>
    );
  }

  return (
    <article className="flex items-center justify-center min-h-[calc(100vh-140px)] px-6 py-12 animate-fade-in">
      <section className="w-full max-w-md text-center space-y-6">
        <Logo size="lg" />
        <h1 className="text-headline-lg text-on-surface">
          Signing you in…
        </h1>
        <p className="text-body-md text-on-surface-muted">
          Please wait while we complete your authentication.
        </p>
        {/* Animated spinner */}
        <span
          className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </section>
    </article>
  );
}
