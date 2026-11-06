"use client";

import { useRef } from "react";
import { pollObservations, radarEvents, type CandidateId } from "../../data/radarData";
import { AXIS_DAYS, axisLabel, createScale, pollDateLong, trendPath, Y_TICKS } from "../../lib/chart";
import { useChartWidth, WIDE_WIDTH } from "../../lib/useChartWidth";
import "../poll-data.css";
import "./candidates.css";

export function CandidateChart({ candidateId, color }: { candidateId: CandidateId; color: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useChartWidth(wrapRef);
  const compact = width < WIDE_WIDTH;
  const chart = { left: compact ? 40 : 72, right: width - (compact ? 12 : 40), top: 32, bottom: 300 };
  const scale = createScale(chart);
  const axisDays = compact ? AXIS_DAYS.filter((day) => [0, 30, 60, 91].includes(day)) : AXIS_DAYS;

  return (
    <>
      <div className={`candidate-chart-wrap ${compact ? "is-compact" : ""}`} ref={wrapRef}><svg viewBox={`0 0 ${width} 352`} role="img" aria-label="Évolution des intentions de vote, des sondages et des événements">
        {Y_TICKS.map((tick) => <g key={tick}>
          <line x1={chart.left} x2={chart.right} y1={scale.y(tick)} y2={scale.y(tick)} className="plot-grid-line" />
          <text x={chart.left - 12} y={scale.y(tick) + 4} textAnchor="end" className="plot-axis-label">{tick}%</text>
        </g>)}
        {radarEvents.map((event) => <line key={event.id} x1={scale.x(event.pollDay)} x2={scale.x(event.pollDay)} y1={chart.top} y2={chart.bottom} className="plot-event-guide" />)}
        {pollObservations.map((poll) => <circle key={`${poll.pollster}-${poll.day}`} cx={scale.x(poll.day)} cy={scale.y(poll.values[candidateId])} r="3.1" fill={color} className="poll-observation"><title>{`${poll.pollster} · ${poll.values[candidateId]}% · n=${poll.sample.toLocaleString("fr-FR")}`}</title></circle>)}
        <path d={trendPath(candidateId, scale)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {axisDays.map((day) => <text key={day} x={scale.x(day)} y="326" textAnchor={compact && day === 0 ? "start" : compact && day === 91 ? "end" : "middle"} className="plot-month-label">{axisLabel(day)}</text>)}
      </svg></div>
      <details className="poll-data">
        <summary>Voir les sondages sous forme de tableau</summary>
        <div className="poll-data-scroll">
          <table>
            <caption>Sondages : intentions de vote pour ce candidat (données de démonstration)</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Institut</th><th scope="col">Échantillon</th><th scope="col">Intentions de vote</th></tr></thead>
            <tbody>{pollObservations.map((poll) => <tr key={`${poll.pollster}-${poll.day}`}><th scope="row">{pollDateLong(poll.day)}</th><td>{poll.pollster}</td><td>{poll.sample.toLocaleString("fr-FR")}</td><td>{poll.values[candidateId]} %</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </>
  );
}
