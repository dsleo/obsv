"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { pollCandidates } from "../../data/chartData";
import { sitePath } from "../../lib/paths";
export type GridEvent = {
  id: string;
  title: string;
  summary: string;
  summaryKind?: "source" | "coverage";
  tag: string;
  shortDate: string;
  date: string;
  isoDate: string;
  image: string;
  imageUrl?: string;
  imageCredit?: string;
  color: string;
  candidateIds: string[];
};
export function StoryImage({
  event,
  featured = false,
}: {
  event: Pick<GridEvent, "imageUrl" | "color" | "date" | "tag">;
  featured?: boolean;
}) {
  return (
    <span
      className={`news-story-image ${featured ? "is-featured" : ""} ${event.imageUrl ? "" : "is-placeholder"}`}
      aria-hidden="true"
    >
      {event.imageUrl ? (
        <img
          src={event.imageUrl}
          alt=""
          loading={featured ? "eager" : "lazy"}
          width="640"
          height="360"
        />
      ) : (
        <span className="news-type-art">{event.tag || "ACTUALITÉ"}</span>
      )}
      <span className="news-story-image-index">{event.date}</span>
    </span>
  );
}
const PAGE = 6;
const empty = { q: "", type: "", candidate: "", page: 1 };
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
export function EventGrid({ events }: { events: GridEvent[] }) {
  const [filters, setFilters] = useState(empty);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(location.search);
      setSearchOpen(Boolean(q.get("q")));
      setFilters({
        q: (q.get("q") ?? "").slice(0, 200),
        type: q.get("type") ?? "",
        candidate: q.get("candidate") ?? "",
        page: Math.max(1, Math.min(100, Number(q.get("page")) || 1)),
      });
    };
    read();
    addEventListener("popstate", read);
    return () => removeEventListener("popstate", read);
  }, []);
  const update = (changes: Partial<typeof empty>) => {
    const next = { ...filters, ...changes, page: changes.page ?? 1 };
    setFilters(next);
    const url = new URL(location.href);
    for (const [k, v] of Object.entries(next)) {
      if (v && !(k === "page" && v === 1)) url.searchParams.set(k, String(v));
      else url.searchParams.delete(k);
    }
    history.replaceState(null, "", url);
  };
  const rows = events.filter(
    (e) =>
      (!filters.q ||
        fold(e.title + " " + (e.summaryKind === "coverage" ? "" : e.summary)).includes(
          fold(filters.q),
        )) &&
      (!filters.type || e.tag === filters.type) &&
      (!filters.candidate || e.candidateIds.includes(filters.candidate)),
  );
  const tags = [...new Set(events.map((e) => e.tag).filter(Boolean))].sort();
  const active = Object.entries(filters).some(([k, v]) => k !== "page" && !!v);
  return (
    <>
      <div className="archive-tools">
        <button
          type="button"
          className="archive-icon-control"
          aria-label="Rechercher une actualité"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((value) => !value)}
        >
          {searchOpen ? <X size={17} /> : <Search size={17} />}
        </button>
        {searchOpen && (
          <label className="archive-search">
            <span className="sr-only">Rechercher une actualité</span>
            <input
              autoFocus
              type="search"
              value={filters.q}
              maxLength={200}
              placeholder="Un nom, un sujet, un lieu…"
              onChange={(e) => update({ q: e.target.value })}
            />
          </label>
        )}
        <details className="archive-advanced">
          <summary aria-label={active ? "Filtres actifs" : "Filtrer les actualités"}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span className="sr-only">Filtrer les actualités</span>
          </summary>
          <div className="archive-filter-fields">
            <label>
              Type
              <select value={filters.type} onChange={(e) => update({ type: e.target.value })}>
                <option value="">Tous les types</option>
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Candidat
              <select
                value={filters.candidate}
                onChange={(e) => update({ candidate: e.target.value })}
              >
                <option value="">Tous les candidats</option>
                {pollCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        {active && (
          <button type="button" className="archive-reset" onClick={() => update(empty)}>
            Effacer les filtres
          </button>
        )}
      </div>
      <section className="news-event-grid" aria-label="Résultats de l’archive">
        {rows.slice(0, filters.page * PAGE).map((e) => (
          <a href={sitePath(`/events/${e.id}`)} className="news-story-card" key={e.id}>
            {e.imageUrl && <StoryImage event={e} />}
            <div className="news-story-card-copy">
              <div className="news-story-meta">
                <span>{e.tag}</span>
                <time dateTime={e.isoDate}>{e.shortDate}</time>
              </div>
              <h3>{e.title}</h3>
              {e.summaryKind !== "coverage" && <p>{e.summary}</p>}
            </div>
          </a>
        ))}
      </section>
      {!rows.length && (
        <div className="empty-state">
          <p>
            Aucune actualité ne correspond à cette sélection. Essayez un autre terme ou une période
            plus large.
          </p>
          {active && (
            <button type="button" onClick={() => update(empty)}>
              Réinitialiser la recherche
            </button>
          )}
        </div>
      )}
      {filters.page * PAGE < rows.length && (
        <button
          type="button"
          className="news-more"
          onClick={() => update({ page: filters.page + 1 })}
        >
          Voir plus d’actualités
        </button>
      )}
    </>
  );
}
