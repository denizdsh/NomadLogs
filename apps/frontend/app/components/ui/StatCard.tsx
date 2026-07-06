import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  className?: string;
}

export function StatCard({ icon, label, value, className = "" }: StatCardProps) {
  return (
    <article
      className={`flex items-center gap-4 rounded-2xl bg-surface border border-border-custom p-5 transition-all hover:shadow-md ${className}`}
    >
      <figure className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary flex-shrink-0">
        {icon}
      </figure>
      <section>
        <p className="text-headline-md text-on-surface leading-none">{value}</p>
        <p className="text-label-md text-on-surface-muted mt-0.5">{label}</p>
      </section>
    </article>
  );
}
