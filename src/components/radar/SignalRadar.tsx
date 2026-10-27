"use client";

import Link from "next/link";
import { ChevronRight, Orbit } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { pollCandidates, pollObservations, radarEvents, type PollObservation } from "../../data/radarData";
import { AXIS_DAYS, axisLabel, createScale, pollDateLong, trendPath, Y_TICKS } from "../../lib/chart";
import { useChartWidth, WIDE_WIDTH } from "../../lib/useChartWidth";
import { MethodExplainer } from "./MethodExplainer";
import "../poll-data.css";
import "./radar.css";

type FilterKey = "all" | "budget" | "coalition" | "foreign" | "programme";
type Candidate = (typeof pollCandidates)[number];

const CHART_HEIGHT = 472;
const COMPACT_HEIGHT = 512;

function RadarChart({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useChartWidth(wrapRef);
  const compact = width < WIDE_WIDTH;
  const plot = { left: compact ? 40 : 74, right: width - (compact ? 12 : 40), top: 32, bottom: 332 };
  const { x: xAt, y: yAt } = createScale(plot);
  const railGap = compact ? 34 : 20;
  const axisDays = compact ? AXIS_DAYS.filter((day) => [0, 30, 60, 91].includes(day)) : AXIS_DAYS;
  const [hoveredPoll, setHoveredPoll] = useState<{ poll: PollObservation; candidate: Candidate; x: number; y: number } | null>(null);
  const showPoll = (poll: PollObservation, candidate: Candidate, circle: SVGCircleElement) => {
    const plotBounds = circle.closest(".radar-plot")?.getBoundingClientRect();
    const circleBounds = circle.getBoundingClientRect();
    if (!plotBounds) return;
    const x = circleBounds.left + circleBounds.width / 2 - plotBounds.left;
    const y = circleBounds.top - plotBounds.top;
    setHoveredPoll({ poll, candidate, x: Math.max(150, Math.min(plotBounds.width - 150, x)), y: Math.max(108, y) });
  };

  return (
    <div className={`radar-plot ${compact ? "is-compact" : ""}`} ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${compact ? COMPACT_HEIGHT : CHART_HEIGHT}`} role="img" aria-labelledby="plot-title plot-description">
        <title id="plot-title">Intentions de vote au premier tour et évolution des sondages</title>
        <desc id="plot-description">Les courbes de six candidats sont établies à partir de plusieurs sondages. Les points représentent les résultats de chaque sondage et les repères verticaux, cinq événements datés. Les valeurs sont aussi disponibles dans le tableau sous le graphique.</desc>
        <defs><clipPath id="plot-area-clip"><rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} /></clipPath></defs>

        {Y_TICKS.map((tick) => <g key={tick}>
          <line x1={plot.left} x2={plot.right} y1={yAt(tick)} y2={yAt(tick)} className="plot-grid-line" />
          <text x={plot.left - 12} y={yAt(tick) + 4} textAnchor="end" className="plot-axis-label">{tick}%</text>
        </g>)}

        <g clipPath="url(#plot-area-clip)">
          {radarEvents.map((event) => <line key={`guide-${event.id}`} x1={xAt(event.pollDay)} x2={xAt(event.pollDay)} y1={plot.top} y2={plot.bottom} className={`plot-event-guide ${selectedId === event.id ? "is-selected" : ""}`} />)}
          {pollCandidates.map((candidate) => <path key={candidate.id} d={trendPath(candidate.id, { x: xAt, y: yAt })} fill="none" stroke={candidate.color} className="poll-trend-line" />)}
          {pollObservations.map((poll) => pollCandidates.map((candidate) => <circle
            key={`${poll.pollster}-${poll.day}-${candidate.id}`}
            cx={xAt(poll.day)}
            cy={yAt(poll.values[candidate.id])}
            r="2.7"
            fill={candidate.color}
            className="poll-observation"
            onPointerEnter={(event) => showPoll(poll, candidate, event.currentTarget)}
            onPointerLeave={() => setHoveredPoll(null)}
          />))}
        </g>

        {axisDays.map((day) => <g key={day}>
          <line x1={xAt(day)} x2={xAt(day)} y1={plot.bottom} y2={plot.bottom + 5} className="plot-axis-tick" />
          <text x={xAt(day)} y={plot.bottom + 21} textAnchor="middle" className="plot-month-label">{axisLabel(day)}</text>
        </g>)}

        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="plot-baseline" />
        <text x={plot.left} y="378" className="event-rail-kicker">ÉVÉNEMENTS</text>
        {radarEvents.map((event, index) => {
          const x = xAt(event.pollDay);
          const anchor = x < (compact ? 52 : 110) ? "start" : x > width - (compact ? 60 : 80) ? "end" : "middle";
          const isSelected = selectedId === event.id;
          const selectEvent = () => {
            onSelect(event.id);
            window.setTimeout(() => document.getElementById(`feed-event-${event.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
          };
          return <g key={`event-${event.id}`} className={`plot-event ${isSelected ? "is-selected" : ""}`} role="button" tabIndex={0} aria-label={`Voir dans le fil : ${event.title}`} onClick={selectEvent} onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); selectEvent(); }
          }}>
            <line x1={x} x2={x} y1="390" y2="401" stroke={event.color} strokeWidth="2" />
            <circle cx={x} cy="390" r="6" fill={event.color} className="event-rail-dot" />
            <text x={x} y={418 + (index % 2) * railGap} textAnchor={anchor} className="event-rail-label">{event.tag}</text>
            <text x={x} y={430 + (index % 2) * railGap} textAnchor={anchor} className="event-rail-date">{event.shortDate}</text>
          </g>;
        })}
      </svg>
      {hoveredPoll && <div className="radar-poll-tooltip" style={{ left: hoveredPoll.x, top: hoveredPoll.y }} aria-hidden="true">
        <span>{hoveredPoll.poll.pollster} · {pollDateLong(hoveredPoll.poll.day)}</span>
        <strong style={{ color: hoveredPoll.candidate.color }}>{hoveredPoll.candidate.name} <b>{hoveredPoll.poll.values[hoveredPoll.candidate.id]} %</b></strong>
        <small>Échantillon : {hoveredPoll.poll.sample.toLocaleString("fr-FR")} personnes</small>
      </div>}
    </div>
  );
}

function PollTable() {
  return (
    <details className="poll-data">
      <summary>Voir les sondages sous forme de tableau</summary>
      <div className="poll-data-scroll">
        <table>
          <caption>Intentions de vote par sondage, en pourcentage (données de démonstration)</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Institut</th><th scope="col">Échantillon</th>{pollCandidates.map((candidate) => <th scope="col" key={candidate.id}>{candidate.short}</th>)}</tr></thead>
          <tbody>{pollObservations.map((poll) => <tr key={`${poll.pollster}-${poll.day}`}>
            <th scope="row">{pollDateLong(poll.day)}</th><td>{poll.pollster}</td><td>{poll.sample.toLocaleString("fr-FR")}</td>
            {pollCandidates.map((candidate) => <td key={candidate.id}>{poll.values[candidate.id]} %</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

export function SignalRadar({ publics = {} }: { publics?: Record<string, string> }) {
  const [selectedId, setSelectedId] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const visibleEvents = useMemo(() => {
    const filtered = activeFilter === "all" ? radarEvents : radarEvents.filter((event) => event.filter === activeFilter);
    return [...filtered].sort((a, b) => b.pollDay - a.pollDay);
  }, [activeFilter]);

  return (
    <main className="radar-page">
      <header className="radar-header">
        <a className="radar-brand" href="#radar" aria-label="L’Observatoire, accueil"><span className="radar-brand-mark"><Orbit size={19} strokeWidth={1.7} /></span><span>L’OBSERVATOIRE</span></a>
        <nav className="radar-nav" aria-label="Navigation principale"><a className="active" href="#radar">Le radar</a><Link href="/events">Événements</Link><Link href="/candidates">Candidats</Link></nav>
      </header>

      <section className="radar-workspace" id="radar">
        <div className="radar-chart-panel">
          <div className="panel-heading"><div><h1 className="radar-chart-title">Les intentions de vote <i>à l’épreuve de l’actualité.</i></h1></div><span className="poll-window">30 JUIN — 29 SEPT. 2026</span></div>
          <div className="plot-legend">{pollCandidates.map((candidate) => <span key={candidate.id}><i style={{ backgroundColor: candidate.color }} />{candidate.short}</span>)}</div>
          <RadarChart selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setActiveFilter("all"); }} />
          <PollTable />
        </div>
      </section>

      <section className="radar-feed-section" id="events">
        <div className="feed-heading"><div><h2>Les événements qui <i>font bouger les lignes.</i></h2></div><a className="method-jump" href="#method">Comment ça marche&nbsp;? <ChevronRight size={14} /></a></div>
        <div className="feed-filters" aria-label="Filtrer les événements">{(["all", "budget", "coalition", "foreign", "programme"] as FilterKey[]).map((filter) => <button key={filter} type="button" className={activeFilter === filter ? "active" : ""} aria-pressed={activeFilter === filter} onClick={() => setActiveFilter(filter)}>{filter === "all" ? "Tous" : filter === "foreign" ? "International" : filter === "budget" ? "Budget" : filter === "coalition" ? "Coalition" : "Programme"}</button>)}</div>
        <div className="feed-list" onMouseLeave={() => setSelectedId("")}>{visibleEvents.map((event) => <Link id={`feed-event-${event.id}`} key={event.id} href={`/events/${event.id}`} className={`feed-item ${selectedId === event.id ? "is-selected" : ""}`} onMouseEnter={() => setSelectedId(event.id)}>
          <time className="feed-date">{event.shortDate}<small>2026</small></time>
          <span className="feed-image" style={{ backgroundImage: `url(${event.image})` }}><span style={{ backgroundColor: event.color }} /></span>
          <span className="feed-item-copy"><span className="feed-item-topline"><b>{event.tag}</b>{publics[event.id] ? <span>Public analysé : {publics[event.id]}</span> : null}</span><strong>{event.title}</strong><span className="feed-summary">{event.summary}</span></span>
        </Link>)}</div>
        <div className="feed-footer"><Link href="/events">Tous les événements <ChevronRight size={14} /></Link></div>
      </section>

      <MethodExplainer />

    </main>
  );
}
