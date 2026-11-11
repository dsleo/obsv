"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { OverflowFilters } from "../OverflowFilters";

export type GridEvent = { id: string; title: string; summary: string; tag: string; shortDate: string; date: string; image: string; color: string };

export function StoryImage({ event, featured = false }: { event: Pick<GridEvent, "image" | "color" | "date" | "tag">; featured?: boolean }) {
  return (
    <span className={`news-story-image ${featured ? "is-featured" : ""}`} style={{ backgroundImage: event.image }}>
      <span className="news-story-image-mark" style={{ backgroundColor: event.color }} />
      {event.tag && event.image.startsWith("linear-gradient") ? <span className="news-story-image-label" aria-hidden="true">{event.tag.toLowerCase()}</span> : null}
      <span className="news-story-image-index">{event.date.slice(0, 2)}</span>
    </span>
  );
}

const PAGE = 24;

/** Archive grid: filter by type, 24 at a time (the full list is ~200 cards). */
export function EventGrid({ events }: { events: GridEvent[] }) {
  const [tag, setTag] = useState("");
  const [shown, setShown] = useState(PAGE);
  const tags = [...new Set(events.map((e) => e.tag).filter(Boolean))].sort();
  const rows = events.filter((e) => !tag || e.tag === tag);
  return <>
    <OverflowFilters className="news-filters" label="Filtrer par type" value={tag} onChange={(t) => { setTag(t); setShown(PAGE); }} items={[{ key: "", label: "Tous" }, ...tags.map((t) => ({ key: t, label: t }))]} />
    <section className="news-event-grid" aria-label="Événements à la une">
      {rows.slice(0, shown).map((event) => (
        <Link href={`/events/${event.id}`} className="news-story-card" key={event.id}>
          <StoryImage event={event} />
          <div className="news-story-card-copy">
            <div className="news-story-meta"><span>{event.tag}</span><time>{event.shortDate}</time></div>
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
          </div>
        </Link>
      ))}
    </section>
    {shown < rows.length ? <button type="button" className="news-more" onClick={() => setShown(shown + PAGE)}>Voir plus d’événements <small>({rows.length - shown})</small> <ChevronDown size={18} aria-hidden="true" /></button> : null}
  </>;
}
