"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import "./overflow-filters.css";

type Item = { key: string; label: string };

/** One-line filter pills: what does not fit moves into a "+" menu; the selected pill is always visible. */
export function OverflowFilters({ items, value, onChange, label, className = "" }: { items: Item[]; value: string; onChange: (key: string) => void; label: string; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(items.length);
  const [open, setOpen] = useState(false);
  const sig = items.map((i) => i.key).join("|");

  useLayoutEffect(() => {
    const root = rootRef.current, m = measureRef.current;
    if (!root || !m) return;
    const calc = () => {
      const kids = [...m.children] as HTMLElement[];
      const widths = kids.slice(0, -1).map((k) => k.offsetWidth), plus = kids[kids.length - 1].offsetWidth;
      const gap = parseFloat(getComputedStyle(root).columnGap) || 6, avail = root.clientWidth;
      if (widths.reduce((a, w) => a + w, 0) + gap * (widths.length - 1) <= avail) return setFit(widths.length);
      let used = plus, n = 0;
      for (const w of widths) { if (used + gap + w > avail) break; used += gap + w; n++; }
      setFit(Math.max(1, n));
    };
    calc();
    const observer = new ResizeObserver(calc);
    observer.observe(root);
    return () => observer.disconnect();
  }, [sig]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const activeIndex = items.findIndex((i) => i.key === value);
  const visible = activeIndex >= fit && fit > 0 ? [...items.slice(0, fit - 1), items[activeIndex]] : items.slice(0, fit);
  const hidden = items.filter((i) => !visible.includes(i));
  const pill = (i: Item) => <button key={i.key || "all"} type="button" className={value === i.key ? "active" : ""} aria-pressed={value === i.key} onClick={() => { onChange(i.key); setOpen(false); }}>{i.label}</button>;

  return (
    <div ref={rootRef} className={`${className} pill-row`} role="group" aria-label={label}>
      {visible.map(pill)}
      {hidden.length ? <button type="button" className="pill-more" aria-expanded={open} aria-label={`Plus de filtres (${hidden.length})`} onClick={() => setOpen(!open)}><Plus size={16} aria-hidden="true" /></button> : null}
      {open ? <div className="pill-menu">{hidden.map(pill)}</div> : null}
      <div ref={measureRef} className="pill-measure" aria-hidden="true">
        {items.map((i) => <button key={i.key || "all"} type="button" tabIndex={-1}>{i.label}</button>)}
        <button type="button" tabIndex={-1}><Plus size={16} /></button>
      </div>
    </div>
  );
}
