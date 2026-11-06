"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { plotWidthFor } from "../lib/chart";
import "./scroll-chart.css";

const COMPACT_BELOW = 780;
const AXIS_WIDTH = { wide: 56, compact: 40 };

type Props = {
  height: number | ((compact: boolean) => number);
  /** Fixed left column (y labels): drawn once, never scrolls away. */
  axis: ReactNode;
  /** Scrolling plot content, laid out for `width` px. */
  children: (layout: { width: number; compact: boolean }) => ReactNode;
  className?: string;
  svgProps?: SVGProps<SVGSVGElement>;
};

/** Horizontally scrollable chart: starts scrolled to the latest date and keeps the y axis in view. */
export function ScrollChart({ height: heightProp, axis, children, className = "", svgProps }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const [viewport, setViewport] = useState(980);
  const compact = viewport < COMPACT_BELOW;
  const axisWidth = compact ? AXIS_WIDTH.compact : AXIS_WIDTH.wide;
  const width = plotWidthFor(viewport - axisWidth - 2);
  const height = typeof heightProp === "function" ? heightProp(compact) : heightProp;

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const measure = () => setViewport(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Latest date first: jump to the right edge whenever the plot width changes.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [width]);

  return (
    <div className={`scroll-chart ${compact ? "is-compact" : ""} ${className}`} ref={wrapRef}>
      <svg className="scroll-chart-axis" aria-hidden="true" style={{ width: axisWidth, height }}>{axis}</svg>
      <div className="scroll-chart-body" ref={scrollRef} tabIndex={0}
        // The scrollbar is hidden: wheel/touch scroll natively, mouse users can drag.
        onPointerDown={(event) => { if (event.pointerType === "mouse" && scrollRef.current) drag.current = { x: event.clientX, left: scrollRef.current.scrollLeft }; }}
        onPointerMove={(event) => { if (drag.current && scrollRef.current) scrollRef.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }} role="region" aria-label="Graphique défilable horizontalement">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} {...svgProps}>{children({ width, compact })}</svg>
      </div>
    </div>
  );
}
