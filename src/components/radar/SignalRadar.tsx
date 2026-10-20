"use client";

import Link from "next/link";
import { ChevronRight, CircleDot, Orbit } from "lucide-react";
import { useMemo, useState } from "react";
import { pollCandidates, pollObservations, radarEvents } from "../../data/radarData";
import "./radar.css";

type FilterKey = "all" | "budget" | "coalition" | "foreign" | "programme";

const dayLabels = [
  { day: 0, label: "30 JUIN" }, { day: 14, label: "14 JUIL." }, { day: 30, label: "30 JUIL." },
  { day: 45, label: "14 AOÛT" }, { day: 60, label: "29 AOÛT" }, { day: 75, label: "13 SEPT." }, { day: 91, label: "29 SEPT." },
];
const plot = { left: 74, right: 940, top: 32, bottom: 332 };
const xAt = (day: number) => plot.left + (day / 91) * (plot.right - plot.left);
const yAt = (value: number) => plot.bottom - (value / 35) * (plot.bottom - plot.top);

function smoothedValue(candidateId: string, day: number) {
  let sum = 0;
  let weight = 0;
  for (const poll of pollObservations) {
    const w = Math.exp(-Math.pow(day - poll.day, 2) / 18);
    sum += w * poll.values[candidateId as keyof typeof poll.values];
    weight += w;
  }
  return weight > 0.35 ? sum / weight : null;
}

function trendPath(candidateId: string) {
  const points: string[] = [];
  for (let day = 0; day <= 91; day += 1) {
    const value = smoothedValue(candidateId, day);
    if (value !== null) points.push(`${points.length ? "L" : "M"}${xAt(day).toFixed(1)},${yAt(value).toFixed(1)}`);
  }
  return points.join(" ");
}

function RadarChart({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const yTicks = [0, 5, 10, 15, 20, 25, 30, 35];

  return (
    <div className="radar-plot">
      <svg viewBox="0 0 980 472" role="img" aria-labelledby="plot-title plot-description" preserveAspectRatio="none">
        <title id="plot-title">Intentions de vote au premier tour et évolution des sondages</title>
        <desc id="plot-description">Les courbes de six candidats sont établies à partir de plusieurs sondages. Les points représentent les résultats de chaque sondage et les repères verticaux, cinq événements datés.</desc>
        <defs><clipPath id="plot-area-clip"><rect x={plot.left} y={plot.top} width={plot.right - plot.left} height={plot.bottom - plot.top} /></clipPath></defs>

        {yTicks.map((tick) => <g key={tick}>
          <line x1={plot.left} x2={plot.right} y1={yAt(tick)} y2={yAt(tick)} className="plot-grid-line" />
          <text x={plot.left - 12} y={yAt(tick) + 4} textAnchor="end" className="plot-axis-label">{tick}%</text>
        </g>)}

        <g clipPath="url(#plot-area-clip)">
          {radarEvents.map((event) => <line key={`guide-${event.id}`} x1={xAt(event.pollDay)} x2={xAt(event.pollDay)} y1={plot.top} y2={plot.bottom} className={`plot-event-guide ${selectedId === event.id ? "is-selected" : ""}`} />)}
          {pollCandidates.map((candidate) => <path key={candidate.id} d={trendPath(candidate.id)} fill="none" stroke={candidate.color} className="poll-trend-line" />)}
          {pollObservations.map((poll) => pollCandidates.map((candidate) => <circle
            key={`${poll.pollster}-${poll.day}-${candidate.id}`}
            cx={xAt(poll.day)}
            cy={yAt(poll.values[candidate.id])}
            r="2.7"
            fill={candidate.color}
            className="poll-observation"
          ><title>{`${poll.pollster} · ${poll.day} jours depuis le 30 juin · ${candidate.short} : ${poll.values[candidate.id]} % · n=${poll.sample.toLocaleString("fr-FR")}`}</title></circle>))}
        </g>

        {dayLabels.map(({ day, label }) => <g key={label}>
          <line x1={xAt(day)} x2={xAt(day)} y1={plot.bottom} y2={plot.bottom + 5} className="plot-axis-tick" />
          <text x={xAt(day)} y={plot.bottom + 21} textAnchor="middle" className="plot-month-label">{label}</text>
        </g>)}

        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="plot-baseline" />
        <text x={plot.left} y="378" className="event-rail-kicker">ÉVÉNEMENTS</text>
        {radarEvents.map((event, index) => {
          const x = xAt(event.pollDay);
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
            <text x={x} y={418 + (index % 2) * 20} textAnchor={x < 110 ? "start" : x > 900 ? "end" : "middle"} className="event-rail-label">{event.tag}</text>
            <text x={x} y={430 + (index % 2) * 20} textAnchor={x < 110 ? "start" : x > 900 ? "end" : "middle"} className="event-rail-date">{event.shortDate}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

export function SignalRadar() {
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
        <nav className="radar-nav" aria-label="Navigation principale"><a className="active" href="#radar">Le radar</a><Link href="/events">Événements</Link></nav>
        <div className="radar-header-status"><Link href="/candidates" className="candidate-shortcut">Candidats</Link><span className="live-dot" /> MODÈLE ACTIF <b>20 OCT. 2026</b></div>
      </header>

      <section className="radar-workspace" id="radar">
        <div className="radar-chart-panel">
          <div className="panel-heading"><div><h1 className="radar-chart-title">Les intentions de vote <i>à l’épreuve de l’actualité.</i></h1></div><span className="poll-window">30 JUIN — 29 SEPT. 2026</span></div>
          <div className="plot-legend">{pollCandidates.map((candidate) => <span key={candidate.id}><i style={{ backgroundColor: candidate.color }} />{candidate.short}</span>)}</div>
          <RadarChart selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setActiveFilter("all"); }} />
        </div>
      </section>

      <section className="radar-feed-section" id="events">
        <div className="feed-heading"><div><h2>Les événements qui <i>font bouger les lignes.</i></h2></div></div>
        <div className="feed-filters" aria-label="Filtrer les événements">{(["all", "budget", "coalition", "foreign", "programme"] as FilterKey[]).map((filter) => <button key={filter} type="button" className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)}>{filter === "all" ? "Tous" : filter === "foreign" ? "International" : filter === "budget" ? "Budget" : filter === "coalition" ? "Coalition" : "Programme"}</button>)}</div>
        <div className="feed-list">{visibleEvents.map((event) => <Link id={`feed-event-${event.id}`} key={event.id} href={`/events/${event.id}`} className={`feed-item ${selectedId === event.id ? "is-selected" : ""}`} onMouseEnter={() => setSelectedId(event.id)} onFocus={() => setSelectedId(event.id)}>
          <time className="feed-date">{event.shortDate}<small>2026</small></time>
          <span className="feed-image" style={{ backgroundImage: `url(${event.image})` }}><span style={{ backgroundColor: event.color }} /></span>
          <span className="feed-item-copy"><span className="feed-item-topline"><b>{event.tag}</b><span>Groupe illustratif : {event.impact.group}</span></span><strong>{event.title}</strong><span className="feed-summary">{event.summary}</span></span>
        </Link>)}</div>
        <div className="feed-footer"><Link href="/events">Tous les événements <ChevronRight size={14} /></Link></div>
      </section>

      <footer className="radar-footer"><span><CircleDot size={12} /> PRÉSIDENTIELLE 2027</span><Link href="/events">Tous les événements <ChevronRight size={14} /></Link></footer>
    </main>
  );
}
