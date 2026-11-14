"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { OverflowFilters } from "../OverflowFilters";
import { PollingExplorer } from "../polls/PollingExplorer";
import { chartEvents, eventFilters, type EventFilter } from "../../data/chartData";
import { sitePath } from "../../lib/paths";
import "./radar.css";
export function SignalRadar({ linkableIds }: { linkableIds: string[] }) {
  const [filter, setFilter] = useState("all");
  const events = useMemo(
    () =>
      chartEvents
        .filter((e) => linkableIds.includes(e.id) && (filter === "all" || e.filter === filter))
        .slice(0, 6),
    [filter, linkableIds],
  );
  return (
    <main className="radar-page" id="contenu">
      <header className="radar-header">
        <Link className="radar-brand" href="/" aria-label="L’Observatoire, accueil">
          <span className="radar-brand-mark">
            <BrandMark />
          </span>
          <span>L’Observatoire</span>
        </Link>
        <nav className="radar-nav" aria-label="Navigation principale">
          <Link className="active" aria-current="page" href="/">
            Le radar
          </Link>
          <Link href="/events">Événements</Link>
          <Link href="/candidates">Candidats</Link>
          <Link href="/method">Méthode</Link>
        </nav>
      </header>
      <section className="radar-motto compact-intro">
        <span className="panel-kicker">PRÉSIDENTIELLE 2027</span>
        <h1>
          Les faits, <em>leurs effets possibles.</em>
        </h1>
        <p>Suivre les faits, lire les tendances, explorer les hypothèses.</p>
      </section>
      <section className="radar-workspace" aria-label="Sondages observés">
        <div className="radar-chart-panel">
          <PollingExplorer eventIds={linkableIds} />
        </div>
      </section>
      <section className="radar-feed-section" id="events">
        <div className="feed-heading">
          <h2>
            Les événements qui <i>font bouger les lignes.</i>
          </h2>
        </div>
        <OverflowFilters
          className="feed-filters"
          label="Filtrer les événements"
          value={filter}
          onChange={setFilter}
          items={[
            { key: "all", label: "Tous" },
            ...Object.entries(eventFilters)
              .filter(([key]) => key !== "context")
              .map(([key, label]) => ({ key, label })),
          ]}
        />
        <div className="feed-list">
          {events.map((e) => (
            <a key={e.id} href={sitePath(`/events/${e.id}`)} className="feed-item">
              <time className="feed-date" dateTime={e.isoDate}>
                {e.shortDate}
                <small>{e.isoDate.slice(0, 4)}</small>
              </time>
              <span className="feed-item-copy">
                <span className="feed-item-topline">
                  <b>{e.tag}</b>
                </span>
                <strong>{e.title}</strong>
                {e.summaryKind !== "coverage" && <span className="feed-summary">{e.summary}</span>}
              </span>
            </a>
          ))}
        </div>
        {!events.length && (
          <p className="empty-state">
            Aucun événement dans cette catégorie.{" "}
            <button type="button" onClick={() => setFilter("all")}>
              Afficher tous les événements
            </button>
          </p>
        )}
        <div className="feed-footer">
          <Link href="/events">
            Tous les événements <ChevronRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
