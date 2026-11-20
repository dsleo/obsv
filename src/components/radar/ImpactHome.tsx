"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { dayOffset, dayToIso, formatShortDate, pollCandidates } from "../../data/chartData";
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
const HEAT_START = dayOffset("2026-10-27"); // earlier weeks have too few analyses
const MAX_COLS = 6;
const label = (id: string) => (id === "abstention" ? "Abstention" : pollCandidates.find((c) => c.id === id)?.short ?? id);
const pct = (s: number) => `${s > 0 ? "+" : "−"}${Math.round(Math.abs(s) * 100)} %`;
// Colour = intensity (saturates at 40 %): orange = more inclined, teal-grey = less inclined.
const tint = (s: number) =>
  `color-mix(in srgb, ${s > 0 ? "var(--impact-positive)" : "var(--impact-negative)"} ${Math.round(Math.min(1, Math.abs(s) / 0.4) * 100)}%, transparent)`;

export function ImpactHome({ data }: { data: ImpactData }) {
  const last = Math.max(...Object.values(data.meta).map((m) => m.pollDay));
  const weeks = Math.floor((last - HEAT_START) / 7);
  const [week, setWeek] = useState(weeks);
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setWeek((current) => (current >= weeks ? (setPlaying(false), current) : current + 1)), 1200);
    return () => clearInterval(timer);
  }, [playing, weeks]);

  // The headline and matrix always describe the same selected week.
  const hero = useMemo(
    () => Object.values(data.heroes)
      .filter((item) => Math.floor((data.meta[item.eventId].pollDay - HEAT_START) / 7) === week)
      .sort((a, b) => b.share - a.share)[0],
    [data, week],
  );
  const cells = useMemo(
    () => data.cells.filter((c) => Math.floor((data.meta[c.e].pollDay - HEAT_START) / 7) === week),
    [data, week],
  );
  const from = HEAT_START + 7 * week;
  const weekLabel = formatShortDate(dayToIso(Math.min(from + 6, last)));

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
  const reach = new Map<string, number>();
  for (const c of cells) reach.set(c.c, Math.max(reach.get(c.c) ?? 0, Math.abs(c.s)));
  const cols = ["abstention", ...[...reach].filter(([id]) => id !== "abstention").sort((a, b) => b[1] - a[1]).slice(0, MAX_COLS).map(([id]) => id)];
  const rows = L1_ORDER.filter((r) => cols.some((c) => l1.has(`${r}|${c}`)));
  const l2Rows = (r: string) => [...new Set(cells.filter((c) => c.f1 === r).map((c) => c.f2))].sort();

  const cell = (m: Map<string, ImpactCell>, key: string, c: string) => {
    const v = m.get(`${key}|${c}`);
    return (
      <td key={c}>
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
          <span className="impact-kicker">SEMAINE DU {formatShortDate(dayToIso(from))}</span>
          <b className="impact-hero-value">{pct(hero.net / hero.sampled)}</b>
          <div>
            <p className="impact-hero-who">{hero.segmentName}</p>
            <p className="impact-hero-what">
              {hero.direction === "toward" ? "plus enclins à voter pour" : "moins enclins à voter pour"} <em>{hero.label}</em>
            </p>
            <p className="impact-hero-event">
              <span>suite à</span>
              <a href={sitePath(`/events/${hero.eventId}`)} title={data.meta[hero.eventId]?.title}>{data.meta[hero.eventId]?.title}</a>
            </p>
          </div>
        </div>
      ) : (
        <p className="impact-empty">Aucun événement analysé.</p>
      )}

      <h2 className="impact-map-title">Les Français qui ont le plus bougé</h2>
      <div className="impact-map">
        <table>
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c}>{label(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r}>
                <tr>
                  <th scope="row">
                    <button type="button" aria-expanded={open === r} onClick={() => setOpen(open === r ? null : r)}>
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="impact-replay" aria-label="Choisir une semaine">
        <button
          type="button"
          onClick={() => {
            if (!playing && week >= weeks) setWeek(0);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause" : "Rejouer semaine par semaine"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input type="range" min={0} max={weeks} value={week} onChange={(e) => { setPlaying(false); setWeek(Number(e.target.value)); }} aria-label="Semaine affichée" />
        <time>{weekLabel}</time>
      </div>
    </section>
  );
}
