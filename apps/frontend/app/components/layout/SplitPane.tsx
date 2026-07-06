import { useRef, type ReactNode } from "react";
import { useDraggableDivider } from "~/hooks/useDraggableDivider";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  className?: string;
}

export function SplitPane({
  left,
  right,
  initialLeftPercent = 50,
  minLeftPercent = 20,
  maxLeftPercent = 80,
  className = "",
}: SplitPaneProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { leftPercent, handleMouseDown } = useDraggableDivider(containerRef, {
    initialLeftPercent,
    minLeftPercent,
    maxLeftPercent,
  });

  return (
    <section
      ref={containerRef}
      className={`flex h-full ${className}`}
    >
      <section
        className="overflow-y-auto"
        style={{ width: `${leftPercent}%` }}
      >
        {left}
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        className="draggable-divider"
        onMouseDown={handleMouseDown}
      />

      <section
        className="overflow-y-auto flex-1"
        style={{ width: `${100 - leftPercent}%` }}
      >
        {right}
      </section>
    </section>
  );
}
