import { useEffect, useState } from "react";

export const WIDE_WIDTH = 980;
export const COMPACT_BELOW = 780;

/** Wide screens scale the 980px design down; narrow ones draw 1:1 so labels stay legible. */
export function useChartWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(WIDE_WIDTH);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth < COMPACT_BELOW ? Math.max(300, node.clientWidth) : WIDE_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
