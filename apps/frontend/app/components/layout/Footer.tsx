import { Link } from "react-router";
import { Heart } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { ROUTES } from "~/constants/routes";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border-custom bg-surface mt-auto">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <nav className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo + Description */}
          <section className="space-y-2">
            <Link
              to={ROUTES.HOME}
              aria-label="NomadLogs Home"
            >
              <Logo size="md" />
            </Link>
            <p className="text-body-sm text-on-surface-muted max-w-xs">
              A decentralized travel community platform for sharing journeys and
              planning adventures.
            </p>
          </section>

          {/* Links */}
          <ul className="flex flex-wrap items-center gap-6">
            <li>
              <Link
                to={ROUTES.ABOUT}
                className="text-label-lg text-on-surface-muted hover:text-primary transition-colors"
              >
                About Us
              </Link>
            </li>
            <li>
              <Link
                to={ROUTES.TERMS}
                className="text-label-lg text-on-surface-muted hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                to={ROUTES.PRIVACY}
                className="text-label-lg text-on-surface-muted hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
            </li>
          </ul>

          {/* Support */}
          <section>
            <a
              href="https://ko-fi.com/nomadlogs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border-custom text-label-lg text-on-surface-muted hover:text-tertiary hover:border-tertiary transition-all"
            >
              <Heart size={16} />
              Support our work
            </a>
          </section>
        </nav>

        {/* Copyright */}
        <p className="mt-8 pt-6 border-t border-border-custom text-label-md text-on-surface-muted text-center">
          © {currentYear} NomadLogs. All rights reserved.
        </p>
      </section>
    </footer>
  );
}
