import type { ReactNode } from "react";

interface ContentGridProps {
  children: ReactNode;
  className?: string;
}

export function ContentGrid({ children, className = "" }: ContentGridProps) {
  return (
    <ul
      className={`grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 ${className}`}
    >
      {children}
    </ul>
  );
}
