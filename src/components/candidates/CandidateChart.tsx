"use client";

import { chartEvents, POLL_DAYS, pollObservations, type CandidateId } from "../../data/radarData";
import { AXIS_DAYS, axisLabel, createScale, trendPath, Y_TICKS } from "../../lib/chart";
import { ScrollChart } from "../ScrollChart";
import "./candidates.css";

const TOP = 32;
const BOTTOM = 300;
const yAt = createScale({ left: 0, right: 1, top: TOP, bottom: BOTTOM }).y;

export function CandidateChart({ candidateId, color }: { candidateId: CandidateId; color: string }) {
  const polls = pollObservations.filter((poll) => poll.values[candidateId] !== undefined);
  const axis = Y_TICKS.map((tick) => <text key={tick} x="100%" dx="-10" y={yAt(tick) + 4} textAnchor="end" className="plot-axis-label">{tick}%</text>);

  return (
    <>
      <ScrollChart className="candidate-chart-wrap" height={352} axis={axis} svgProps={{ role: "img", "aria-label": "Évolution des intentions de vote, des sondages et des événements" }}>
        {({ width }) => {
          const scale = createScale({ left: 12, right: width - 12, top: TOP, bottom: BOTTOM });
          return <>
            {Y_TICKS.map((tick) => <line key={tick} x1={12} x2={width - 12} y1={scale.y(tick)} y2={scale.y(tick)} className="plot-grid-line" />)}
            {chartEvents.map((event) => <line key={event.id} x1={scale.x(event.pollDay)} x2={scale.x(event.pollDay)} y1={TOP} y2={BOTTOM} className="plot-event-guide" />)}
            {polls.map((poll) => <circle key={`${poll.pollster}-${poll.day}`} cx={scale.x(poll.day)} cy={scale.y(poll.values[candidateId] ?? 0)} r="3.1" fill={color} className="poll-observation"><title>{`${poll.pollster} · ${poll.values[candidateId]}% · n=${poll.sample.toLocaleString("fr-FR")}`}</title></circle>)}
            <path d={trendPath(candidateId, scale)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {AXIS_DAYS.map((day) => <g key={day}>
              <line x1={scale.x(day)} x2={scale.x(day)} y1={BOTTOM} y2={BOTTOM + 5} className={day === POLL_DAYS ? "plot-axis-now" : "plot-axis-tick"} />
              <text x={scale.x(day)} y="326" textAnchor="middle" className={`plot-month-label ${day === POLL_DAYS ? "is-now" : ""}`}>{axisLabel(day)}</text>
            </g>)}
          </>;
        }}
      </ScrollChart>
    </>
  );
}
