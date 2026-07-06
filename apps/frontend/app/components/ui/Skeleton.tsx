interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  const variantClasses: Record<string, string> = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton() {
  return (
    <article className="rounded-2xl bg-surface border border-border-custom overflow-hidden animate-fade-in">
      <Skeleton className="w-full h-48" />
      <section className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <footer className="flex items-center gap-3 pt-2">
          <Skeleton variant="circular" className="h-8 w-8" />
          <Skeleton className="h-3 w-24" />
        </footer>
      </section>
    </article>
  );
}
