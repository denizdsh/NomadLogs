import { Compass } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      <figure className="mb-6 text-on-surface-muted opacity-40">
        {icon ?? <Compass size={64} strokeWidth={1} />}
      </figure>
      <h3 className="text-headline-md text-on-surface mb-2">{title}</h3>
      <p className="text-body-md text-on-surface-muted max-w-md mb-6">{description}</p>
      {actionLabel && actionHref && (
        <Link to={actionHref}>
          <Button variant="primary">{actionLabel}</Button>
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </section>
  );
}
