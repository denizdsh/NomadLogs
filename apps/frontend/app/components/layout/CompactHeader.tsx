import { Link, useNavigate } from "react-router";
import { ArrowLeft, X } from "lucide-react";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import { Logo } from "~/components/ui/Logo";
import { ROUTES } from "~/constants/routes";

export function CompactHeader() {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-6 py-2 border-b border-border-custom bg-surface/80 backdrop-blur-lg sticky top-0 z-30 h-11 select-none">
      <section className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-border-custom/50 text-on-surface-muted hover:text-on-surface transition-all active:scale-[0.9] cursor-pointer"
          title="Go back"
        >
          <ArrowLeft size={16} />
        </button>
        <Link to={ROUTES.HOME} aria-label="NomadLogs Home">
          <Logo size="sm" />
        </Link>
      </section>

      <section className="flex items-center gap-3">
        <ThemeToggle />
        <Link
          to={ROUTES.HOME}
          className="p-1.5 rounded-lg hover:bg-border-custom/50 text-on-surface-muted hover:text-on-surface transition-all active:scale-[0.9]"
          title="Close and exit"
        >
          <X size={16} />
        </Link>
      </section>
    </header>
  );
}
