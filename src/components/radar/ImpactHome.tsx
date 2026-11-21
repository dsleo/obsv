"use client";
import { Fragment, useMemo, useState } from "react";
import { dayToIso, pollCandidates } from "../../data/chartData";
import { sitePath } from "../../lib/paths";
import { L1_ORDER } from "../../lib/radar/groupFamilies";
import type { TopSolde } from "../../lib/radar/highlights";
import type { ImpactCell } from "../../lib/radar/impactMap";
import "./impact.css";

export type ImpactData = {
  heroes: Record<string, TopSolde>;
  meta: Record<string, { title: string; shortDate: string; pollDay: number }>;
  cells: ImpactCell[];
};
const COLUMN_NUMBER: Record<string, number> = {
  abstention: 0,
  "le-pen": 1,
  melenchon: 2,
  philippe: 3,
  attal: 4,
  glucksmann: 5,
  tondelier: 6,
  roussel: 7,
  retailleau: 8,
  lisnard: 9,
  zemmour: 10,
  "dupont-aignan": 11,
  arthaud: 12,
  bardella: 13,
};
const label = (id: string) => (id === "abstention" ? "Abstention" : pollCandidates.find((c) => c.id === id)?.short ?? id);
const pct = (s: number) => `${s > 0 ? "+" : "−"}${Math.round(Math.abs(s) * 100)} %`;
// Colour = intensity (saturates at 40 %): orange = more inclined, teal-grey = less inclined.
const tint = (s: number) =>
  `color-mix(in srgb, ${s > 0 ? "var(--impact-positive)" : "var(--impact-negative)"} ${Math.round(Math.min(1, Math.abs(s) / 0.4) * 100)}%, transparent)`;

export function ImpactHome({ data }: { data: ImpactData }) {
  const events = useMemo(
    () => Object.keys(data.meta)
      .filter((id) => data.heroes[id])
      .sort((a, b) => data.meta[a].pollDay - data.meta[b].pollDay || a.localeCompare(b)),
    [data],
  );
  const [eventIndex, setEventIndex] = useState(Math.max(0, events.length - 1));
  const [open, setOpen] = useState<string | null>(null);
  const selectedEventId = events[eventIndex];
  const selectedEvent = data.meta[selectedEventId];
  const hero = data.heroes[selectedEventId];
  // Both views use only this event's contrasts; reactions are never accumulated.
  const cells = useMemo(
    () => data.cells.filter((c) => c.e === selectedEventId),
    [data, selectedEventId],
  );

  // Strongest cell per (row, candidate). Rows are level 1 families; a click opens their level 2 rows.
  const strongest = (row: (c: ImpactCell) => string) => {
    const m = new Map<string, ImpactCell>();
    for (const c of cells) {
      const k = `${row(c)}|${c.c}`;
      if (Math.abs(c.s) > Math.abs(m.get(k)?.s ?? 0)) m.set(k, c);
    }
    return m;
  };
  const l1 = strongest((c) => c.f1);
  const l2 = strongest((c) => `${c.f1}>${c.f2}`);
  // Only this event's candidates appear, always in the same relative order.
  const cols = [...new Set(cells.map((c) => c.c))]
    .sort((a, b) => (COLUMN_NUMBER[a] ?? Number.MAX_SAFE_INTEGER) - (COLUMN_NUMBER[b] ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b));
  const l2Rows = (r: string) => [...new Set(cells.filter((c) => c.f1 === r).map((c) => c.f2))].sort();

  const cell = (m: Map<string, ImpactCell>, key: string, c: string) => {
    const v = m.get(`${key}|${c}`);
    return (
      <td key={c} className={v ? undefined : "impact-cell-empty"} aria-label={v ? undefined : "Aucune valeur affichée pour ce groupe et cet événement"}>
        {v ? (
          <a href={sitePath(`/events/${v.e}`)} style={{ background: tint(v.s) }} title={`${data.meta[v.e]?.shortDate} · ${data.meta[v.e]?.title}`}>
            {pct(v.s)}
          </a>
        ) : null}
      </td>
    );
  };

  return (
    <section className="impact" aria-label="Ce qui a pesé, et sur qui">
      <header className="impact-intro">
        <h1 className="impact-title">
          Quand l’actualité tombe, <em>qui change d’avis ?</em>
        </h1>
        <p>Nous simulons comment les événements de la campagne déplacent les intentions de vote des Français.</p>
      </header>

      {hero ? (
        <div className="impact-hero">
          <time className="impact-kicker" dateTime={dayToIso(selectedEvent.pollDay)}>{selectedEvent.shortDate}</time>
          <div className="impact-hero-layout">
            <div className="impact-hero-event-title">
              <span className="impact-label">L’événement</span>
              <a href={sitePath(`/events/${hero.eventId}`)} title={selectedEvent.title}>{selectedEvent.title}</a>
            </div>
            <div className="impact-effect-panel">
              <div className="impact-effect-label">Effet simulé</div>
              <div className="impact-hero-effect">
                <b className="impact-hero-value">{pct(hero.net / hero.sampled)}</b>
                <div className="impact-hero-copy">
                  <p className="impact-hero-who">{hero.segmentName}</p>
                  <p className="impact-hero-what">
                    {hero.direction === "toward" ? "plus enclins à voter pour" : "moins enclins à voter pour"} <em>{hero.label}</em>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="impact-empty">Aucun événement analysé.</p>
      )}

      {selectedEvent && (
        <div className="impact-event-slider" aria-label="Choisir un événement">
          <div className="impact-event-selection">
            <time dateTime={dayToIso(selectedEvent.pollDay)}>{selectedEvent.shortDate}</time>
          </div>
          <input
            id="impact-event"
            type="range"
            min={0}
            max={Math.max(0, events.length - 1)}
            step={1}
            value={eventIndex}
            disabled={events.length < 2}
            aria-label="Événement affiché"
            aria-valuetext={`${selectedEvent.shortDate} · ${selectedEvent.title}`}
            onChange={(e) => {
              setEventIndex(Number(e.target.value));
              setOpen(null);
            }}
          />
        </div>
      )}

      {selectedEvent && (
        <div className="impact-comparison">
          <div className="impact-comparison-content">
            <h2 className="impact-map-title">Les Français qui ont le plus bougé</h2>
              <div className="impact-map" role="region" aria-label="Impacts de l’événement sélectionné par sous-population" tabIndex={0}>
                <table style={{ minWidth: `${16 + cols.length * 5.5}rem` }}>
                  <colgroup>
                    <col style={{ width: "16rem" }} />
                    {cols.map((c) => <col key={c} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th />
                      {cols.map((c) => (
                        <th key={c} scope="col">{label(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {L1_ORDER.map((r) => {
                      const hasValues = cols.some((c) => l1.has(`${r}|${c}`));
                      return (
                      <Fragment key={r}>
                        <tr className={hasValues ? undefined : "impact-row-empty"}>
                          <th scope="row">
                            <button type="button" disabled={!hasValues} aria-expanded={open === r} onClick={() => setOpen(open === r ? null : r)}>
                              {r}
                            </button>
                          </th>
                          {cols.map((c) => cell(l1, r, c))}
                        </tr>
                        {open === r &&
                          l2Rows(r).map((sub) => (
                            <tr key={`${r}>${sub}`} className="impact-sub">
                              <th scope="row">{sub}</th>
                              {cols.map((c) => cell(l2, `${r}>${sub}`, c))}
                            </tr>
                          ))}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          </div>
        </div>
      )}
    </section>
  );
}
