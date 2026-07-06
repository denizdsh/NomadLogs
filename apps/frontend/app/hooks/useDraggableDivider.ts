import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface UseDraggableDividerOptions {
  initialLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
}

export function useDraggableDivider(
  containerRef: RefObject<HTMLElement | null>,
  options: UseDraggableDividerOptions = {}
) {
  const {
    initialLeftPercent = 50,
    minLeftPercent = 20,
    maxLeftPercent = 80,
  } = options;

  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percent = (x / rect.width) * 100;

      setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, percent)));
    },
    [containerRef, minLeftPercent, maxLeftPercent]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { leftPercent, handleMouseDown };
}
