"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { OverflowFilters } from "../OverflowFilters";
import { useMemo, useState } from "react";
import { pollCandidates, pollObservations, chartEvents, eventFilters, LAST_POLL_DAY, POLL_DAYS, pollWindowLabel, type EventFilter, type PollObservation, type RadarEvent } from "../../data/radarData";
import { AXIS_DAYS, axisLabel, createScale, getSmoothedPollValue, pollDateLong, trendPath, Y_TICKS } from "../../lib/chart";
import { ScrollChart } from "../ScrollChart";
import "./radar.css";

type FilterKey = "all" | EventFilter;
type Candidate = (typeof pollCandidates)[number];

const DEFAULT_VISIBLE = 6;
const FEED_SIZE = 6;
// Candidates ranked by current smoothed value: the top few are the readable default view, the rest are one click away.
const rankedCandidates = [...pollCandidates]
  .sort((a, b) => (getSmoothedPollValue(b.id, LAST_POLL_DAY) ?? 0) - (getSmoothedPollValue(a.id, LAST_POLL_DAY) ?? 0));

const CHART_HEIGHT = 440;

const PLOT_TOP = 32;
const PLOT_BOTTOM = 332;
const yAt = createScale({ left: 0, right: 1, top: PLOT_TOP, bottom: PLOT_BOTTOM }).y;

function RadarChart({ selectedId, onSelect, shown }: { selectedId: string; onSelect: (id: string) => void; shown: readonly Candidate[] }) {
  const router = useRouter();
  const [hoveredLine, setHoveredLine] = useState<{ candidate: Candidate; x: number; y: number } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ event: RadarEvent; x: number; y: number } | null>(null);
  const [hoveredPoll, setHoveredPoll] = useState<{ poll: PollObservation; candidate: Candidate; x: number; y: number } | null>(null);
  const showPoll = (poll: PollObservation, candidate: Candidate, circle: SVGCircleElement) => {
    const plotBounds = circle.closest(".radar-plot")?.getBoundingClientRect();
    const circleBounds = circle.getBoundingClientRect();
    if (!plotBounds) return;
    const x = circleBounds.left + circleBounds.width / 2 - plotBounds.left;
    const y = circleBounds.top - plotBounds.top;
    setHoveredPoll({ poll, candidate, x: Math.max(150, Math.min(plotBounds.width - 150, x)), y: Math.max(108, y) });
  };
  // Position (relative to the plot) of an SVG element, with x kept inside the plot so the tooltip is not clipped.
  const anchorOf = (element: Element) => {
    const plotBounds = element.closest(".radar-plot")?.getBoundingClientRect();
    if (!plotBounds) return null;
    const bounds = element.getBoundingClientRect();
    return { x: Math.max(130, Math.min(plotBounds.width - 130, bounds.left + bounds.width / 2 - plotBounds.left)), y: bounds.top - plotBounds.top };
  };
  const axis = Y_TICKS.map((tick) => <text key={tick} x="100%" dx="-10" y={yAt(tick) + 4} textAnchor="end" className="plot-axis-label">{tick}%</text>);

  return (
    <div className="radar-plot">
      <ScrollChart height={CHART_HEIGHT} axis={axis} svgProps={{ role: "group", "aria-labelledby": "plot-title plot-description" }}>
        {({ width, compact }) => {
          const plot = { left: 12, right: width - 12, top: PLOT_TOP, bottom: PLOT_BOTTOM };
          const { x: xAt } = createScale(plot);
          let lastLabelX = Infinity;
          return <>
            <title id="plot-title">Intentions de vote au premier tour et évolution des sondages</title>
            <desc id="plot-description">Les courbes de chaque candidat sont établies à partir des sondages publiés. Les points représentent les résultats de chaque sondage et les repères verticaux, les événements majeurs datés. Les valeurs sont aussi disponibles dans le tableau sous le graphique.</desc>
            <defs><clipPath id="plot-area-clip"><rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} /></clipPath></defs>

            {Y_TICKS.map((tick) => <line key={tick} x1={plot.left} x2={plot.right} y1={yAt(tick)} y2={yAt(tick)} className="plot-grid-line" />)}

            <g clipPath="url(#plot-area-clip)">
              {chartEvents.map((event) => <line key={`guide-${event.id}`} x1={xAt(event.pollDay)} x2={xAt(event.pollDay)} y1={plot.top} y2={plot.bottom} className={`plot-event-guide ${selectedId === event.id ? "is-selected" : ""}`} />)}
              {shown.map((candidate) => {
                const d = trendPath(candidate.id, { x: xAt, y: yAt });
                const state = hoveredLine ? (hoveredLine.candidate.id === candidate.id ? "is-hovered" : "is-dimmed") : "";
                return <g key={candidate.id}>
                  <path d={d} fill="none" stroke={candidate.color} className={`poll-trend-line ${state}`} />
                  {/* wide invisible stroke: an easy hover target for the thin line */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth="16" className="poll-trend-hit" onPointerMove={(event) => {
                    const plotBounds = event.currentTarget.closest(".radar-plot")?.getBoundingClientRect();
                    if (plotBounds) setHoveredLine({ candidate, x: Math.max(70, Math.min(plotBounds.width - 70, event.clientX - plotBounds.left)), y: event.clientY - plotBounds.top });
                  }} onPointerLeave={() => setHoveredLine(null)} />
                </g>;
              })}
              {pollObservations.map((poll) => shown.filter((candidate) => poll.values[candidate.id] !== undefined).map((candidate) => <circle
                key={`${poll.pollster}-${poll.day}-${candidate.id}`}
                cx={xAt(poll.day)}
                cy={yAt(poll.values[candidate.id] ?? 0)}
                r="2.7"
                fill={candidate.color}
                className="poll-observation"
                onPointerEnter={(event) => showPoll(poll, candidate, event.currentTarget)}
                onPointerLeave={() => setHoveredPoll(null)}
              />))}
            </g>

            {AXIS_DAYS.map((day) => <g key={day}>
              <line x1={xAt(day)} x2={xAt(day)} y1={plot.bottom} y2={plot.bottom + 5} className={day === POLL_DAYS ? "plot-axis-now" : "plot-axis-tick"} />
              <text x={xAt(day)} y={plot.bottom + 21} textAnchor="middle" className={`plot-month-label ${day === POLL_DAYS ? "is-now" : ""}`}>{axisLabel(day)}</text>
            </g>)}

            <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="plot-baseline" />
            {chartEvents.map((event) => {
              const x = xAt(event.pollDay);
              // chartEvents is newest-first: label an event only when it is far enough from the last labelled one.
              const labelled = lastLabelX - x >= 100;
              if (labelled) lastLabelX = x;
              const anchor = x < 70 ? "start" : x > width - 70 ? "end" : "middle";
              const isSelected = selectedId === event.id;
              const open = () => router.push(`/events/${event.id}`);
              return <g key={`event-${event.id}`} className={`plot-event ${isSelected ? "is-selected" : ""}`} role="link" tabIndex={0} aria-label={event.title} onClick={open}
                onPointerEnter={(pointerEvent) => { onSelect(event.id); const at = anchorOf(pointerEvent.currentTarget); if (at) setHoveredEvent({ event, ...at }); }}
                onPointerLeave={() => { onSelect(""); setHoveredEvent(null); }}
                onFocus={(focusEvent) => { onSelect(event.id); const at = anchorOf(focusEvent.currentTarget); if (at) setHoveredEvent({ event, ...at }); }}
                onBlur={() => { onSelect(""); setHoveredEvent(null); }}
                onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") { keyboardEvent.preventDefault(); open(); } }}>
                <circle cx={x} cy="390" r="14" fill="transparent" />
                <line x1={x} x2={x} y1="390" y2="401" stroke={event.color} strokeWidth="2" />
                <circle cx={x} cy="390" r="6" fill={event.color} className="event-rail-dot" />
                {labelled ? <text x={x} y="418" textAnchor={anchor} className="event-rail-label">{event.tag}</text> : null}
              </g>;
            })}
          </>;
        }}
      </ScrollChart>
      {hoveredLine && !hoveredPoll && <div className="radar-poll-tooltip radar-line-tooltip" style={{ left: hoveredLine.x, top: hoveredLine.y }} aria-hidden="true">
        <strong style={{ color: hoveredLine.candidate.color }}>{hoveredLine.candidate.name}</strong>
        <small>{hoveredLine.candidate.party}</small>
      </div>}
      {hoveredEvent && <div className="radar-poll-tooltip" style={{ left: hoveredEvent.x, top: hoveredEvent.y }} aria-hidden="true">
        <span>{[hoveredEvent.event.tag, hoveredEvent.event.date].filter(Boolean).join(" · ")}</span>
        <strong>{hoveredEvent.event.title}</strong>
        <small>Cliquer pour ouvrir l’événement</small>
      </div>}
      {hoveredPoll && <div className="radar-poll-tooltip" style={{ left: hoveredPoll.x, top: hoveredPoll.y }} aria-hidden="true">
        <span>{hoveredPoll.poll.pollster} · {pollDateLong(hoveredPoll.poll.day)}</span>
        <strong style={{ color: hoveredPoll.candidate.color }}>{hoveredPoll.candidate.name} <b>{hoveredPoll.poll.values[hoveredPoll.candidate.id]} %</b></strong>
        <small>Échantillon : {hoveredPoll.poll.sample.toLocaleString("fr-FR")} personnes</small>
      </div>}
    </div>
  );
}

export function SignalRadar() {
  const [selectedId, setSelectedId] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rankedCandidates : rankedCandidates.slice(0, DEFAULT_VISIBLE);
  const visibleEvents = useMemo(() => {
    return (activeFilter === "all" ? chartEvents : chartEvents.filter((event) => event.filter === activeFilter)).slice(0, FEED_SIZE); // newest first; the rest is on /events
  }, [activeFilter]);

  return (
    <main className="radar-page">
      <header className="radar-header">
        <Link className="radar-brand" href="/" aria-label="L’Observatoire, accueil"><span className="radar-brand-mark"><BrandMark /></span><span>L’Observatoire</span></Link>
        <nav className="radar-nav" aria-label="Navigation principale"><Link className="active" href="/" aria-current="page">Le radar</Link><Link href="/events">Événements</Link><Link href="/candidates">Candidats</Link></nav>
      </header>

      <section className="radar-motto" aria-labelledby="motto-title">
        <span className="panel-kicker">NOTRE BOUSSOLE</span>
        <h2 id="motto-title">Une seule question : que change l’actualité pour les Français ?</h2>
        <p>Seul compte ce qui pèse sur le quotidien des Français. Pour chaque événement, nous repérons qui est touché, et vers quel candidat son vote peut basculer.</p>
      </section>

      <section className="radar-workspace" id="radar">
        <div className="radar-chart-panel">
          <div className="panel-heading"><div><h1 className="radar-chart-title">Les intentions de vote <i>à l’épreuve de l’actualité.</i></h1></div><span className="poll-window">{pollWindowLabel}</span></div>
          <div className="plot-legend">
            {shown.map((candidate) => <span key={candidate.id}><i style={{ backgroundColor: candidate.color }} />{candidate.short}</span>)}
            <button type="button" className="legend-toggle" aria-expanded={expanded} aria-label={expanded ? `Afficher seulement les ${DEFAULT_VISIBLE} premiers candidats` : "Afficher tous les candidats"} title={expanded ? "Top 6 seulement" : "Afficher tous"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minus size={11} strokeWidth={2.5} /> : <Plus size={11} strokeWidth={2.5} />}</button>
          </div>
          <RadarChart shown={shown} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </section>

      <section className="radar-feed-section" id="events">
        <div className="feed-heading"><div><h2>Les événements qui <i>font bouger les lignes.</i></h2></div></div>
        <OverflowFilters className="feed-filters" label="Filtrer les événements" value={activeFilter} onChange={(key) => setActiveFilter(key as FilterKey)} items={[{ key: "all", label: "Tous" }, ...(Object.keys(eventFilters) as EventFilter[]).filter((k) => k !== "context").map((k) => ({ key: k, label: eventFilters[k] }))]} />
        <div className="feed-list" onMouseLeave={() => setSelectedId("")}>{visibleEvents.map((event) => <Link id={`feed-event-${event.id}`} key={event.id} href={`/events/${event.id}`} className={`feed-item ${selectedId === event.id ? "is-selected" : ""}`} onMouseEnter={() => setSelectedId(event.id)}>
          <time className="feed-date">{event.shortDate}<small>2026</small></time>
          <span className="feed-image" style={{ backgroundImage: event.image }}><span style={{ backgroundColor: event.color }} /></span>
          <span className="feed-item-copy"><span className="feed-item-topline"><b>{event.tag}</b></span><strong>{event.title}</strong><span className="feed-summary">{event.summary}</span></span>
        </Link>)}</div>
        <div className="feed-footer"><Link href="/events">Tous les événements <ChevronRight size={14} /></Link></div>
      </section>

    </main>
  );
}
