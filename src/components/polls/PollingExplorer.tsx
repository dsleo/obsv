"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  chartEvents,
  windowEvents,
  dayToIso,
  formatShortDate,
  LAST_POLL_DAY,
  pollCandidates,
  pollObservations,
  POLL_DAYS,
  type CandidateId,
  type PollObservation,
} from "../../data/chartData";
import { formatPct, getSmoothedPollValue } from "../../lib/chart";
import { sitePath } from "../../lib/paths";
import "./polls.css";

const DASHES = ["", "8 3", "3 3", "10 3 2 3", "1 3", "12 4"];
const rankedIds = [...pollCandidates]
  .sort(
    (a, b) =>
      (getSmoothedPollValue(b.id, LAST_POLL_DAY) ?? 0) -
      (getSmoothedPollValue(a.id, LAST_POLL_DAY) ?? 0),
  )
  .map((candidate) => candidate.id);
const defaultIds = rankedIds.slice(0, 5);

/**
 * The trend stays deliberately compact: the reader can scroll the whole time
 * line, open a marked event directly, and reveal the remaining series only on
 * demand. Poll tables and method notes live on the Method page.
 */
export function PollingExplorer({ candidateId, eventIds }: { candidateId?: CandidateId; eventIds?: string[] }) {
  const initialIds = candidateId
    ? ([candidateId, ...defaultIds.filter((id) => id !== candidateId)].slice(0, 5) as CandidateId[])
    : defaultIds;
  const [ids, setIds] = useState<CandidateId[]>(initialIds);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(860);
  const [hoveredEvent, setHoveredEvent] = useState<{ title: string; x: number } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    candidate: string;
    date: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<{
    observation: PollObservation;
    candidate: string;
    candidateId: CandidateId;
    x: number;
    y: number;
    side: "left" | "right";
    pinned: boolean; // false = hover preview, true = clicked (stays, link usable)
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const sourceCardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIds(initialIds);
  }, [candidateId]);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(320, Math.round(entry.contentRect.width))),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!selectedPoll?.pinned) return;
    const dismiss = (event: PointerEvent) => {
      if (sourceCardRef.current && !sourceCardRef.current.contains(event.target as Node)) setSelectedPoll(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [selectedPoll]);

  const candidates = pollCandidates.filter((candidate) => ids.includes(candidate.id));
  const chartWidth = Math.max(width, 920);
  const left = 36;
  const right = chartWidth - 98;
  const top = 22;
  const bottom = 278;
  const x = (day: number) => left + (day / Math.max(1, POLL_DAYS)) * (right - left);
  const data = useMemo(
    () =>
      candidates.map((candidate) => ({
        candidate,
        points: Array.from({ length: POLL_DAYS + 1 }, (_, day) => ({
          day,
          value:
            day >
            (pollObservations.filter((poll) => poll.values[candidate.id] !== undefined).at(-1)?.day ?? -1)
              ? null
              : getSmoothedPollValue(candidate.id, day),
        })),
      })),
    [ids.join(",")],
  );
  const ymax = Math.max(
    10,
    Math.ceil(Math.max(...data.flatMap((series) => series.points.map((point) => point.value ?? 0)), 0) / 10) *
      10,
  );
  const y = (value: number) => bottom - (value / ymax) * (bottom - top);
  const endpoints = data
    .flatMap(({ candidate, points }) => {
      const last = points.filter((point) => point.value !== null).at(-1);
      return last ? [{ id: candidate.id, day: last.day, value: last.value!, labelY: y(last.value!) }] : [];
    })
    .sort((a, b) => a.labelY - b.labelY);
  for (let index = 0; index < endpoints.length; index++)
    endpoints[index].labelY = Math.max(
      endpoints[index].labelY,
      top + 8,
      index ? endpoints[index - 1].labelY + 14 : top + 8,
    );
  for (let index = endpoints.length - 1; index >= 0; index--)
    endpoints[index].labelY = Math.min(
      endpoints[index].labelY,
      index === endpoints.length - 1 ? bottom : endpoints[index + 1].labelY - 14,
    );

  const toggle = (id: CandidateId) =>
    setIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  const legendCandidates = expanded ? pollCandidates : candidates;
  const ticks = [...new Set([0, Math.round(POLL_DAYS / 2), POLL_DAYS])];
  const plottedEvents = eventIds ? windowEvents.filter((event) => eventIds.includes(event.id)) : chartEvents;
  const revealEvent = (event: (typeof chartEvents)[number], target: Element) => {
    if (!ref.current) return;
    const root = ref.current.getBoundingClientRect();
    const marker = target.getBoundingClientRect();
    setHoveredEvent({
      title: event.title,
      x: Math.max(120, Math.min(root.width - 120, marker.left + marker.width / 2 - root.left)),
    });
  };
  const revealPoint = (
    candidate: (typeof pollCandidates)[number],
    point: { day: number; value: number | null },
    target: Element,
    pointer?: { clientX: number; clientY: number },
  ) => {
    if (point.value === null || !ref.current) return;
    const root = ref.current.getBoundingClientRect();
    const marker = target.getBoundingClientRect();
    const anchorX = pointer ? pointer.clientX - root.left : marker.left + marker.width / 2 - root.left;
    const anchorY = pointer ? pointer.clientY - root.top - 16 : marker.top - root.top - 48;
    setHoveredPoint({
      candidate: candidate.name,
      date: formatShortDate(dayToIso(point.day)),
      value: point.value,
      x: Math.max(96, Math.min(root.width - 96, anchorX)),
      y: Math.max(8, Math.min(root.height - 58, anchorY)),
    });
  };
  const selectPoll = (
    observation: PollObservation,
    candidate: string,
    candidateId: CandidateId,
    target: Element,
    pinned = true,
  ) => {
    if (!ref.current || (!pinned && selectedPoll?.pinned)) return;
    const root = ref.current.getBoundingClientRect();
    const marker = target.getBoundingClientRect();
    const pointX = marker.left + marker.width / 2 - root.left;
    const pointY = marker.top + marker.height / 2 - root.top;
    const side = pointX > root.width * 0.62 ? "left" : "right";
    setSelectedPoll({
      observation,
      candidate,
      candidateId,
      x: side === "left" ? Math.max(12, pointX - 14) : Math.min(root.width - 12, pointX + 14),
      y: Math.max(48, Math.min(root.height - 48, pointY)),
      side,
      pinned,
    });
    setHoveredPoint(null);
  };

  // Hover shows the same card as a click (pollster, value, source) when a poll exists that day; a plain smoothed day keeps the small value card.
  const hover = (
    candidate: (typeof pollCandidates)[number],
    point: { day: number; value: number | null },
    target: Element,
    pointer?: { clientX: number; clientY: number },
  ) => {
    if (selectedPoll?.pinned) return;
    const poll = pollObservations.find((o) => o.day === point.day && o.values[candidate.id] !== undefined);
    if (poll) selectPoll(poll, candidate.name, candidate.id, target, false);
    else revealPoint(candidate, point, target, pointer);
  };
  const unhover = () => {
    setHoveredPoint(null);
    setSelectedPoll((current) => (current?.pinned ? current : null));
  };

  return (
    <div className="poll-explorer">
      <div className="poll-series-key" aria-label="Candidats affichés">
        {legendCandidates.map((candidate, index) => {
          const visible = ids.includes(candidate.id);
          return (
            <button
              type="button"
              className={visible ? "is-visible" : ""}
              key={candidate.id}
              aria-pressed={visible}
              onClick={() => toggle(candidate.id)}
            >
              <svg width="24" height="8" aria-hidden="true">
                <path
                  d="M0 4H24"
                  stroke={candidate.color}
                  strokeWidth="3"
                  strokeDasharray={DASHES[index % DASHES.length]}
                />
              </svg>
              {candidate.short}
            </button>
          );
        })}
        <button
          type="button"
          className="poll-series-more"
          aria-expanded={expanded}
          aria-label={expanded ? "Afficher moins de candidats" : "Afficher plus de candidats"}
          title={expanded ? "Afficher moins" : "Afficher plus"}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      </div>
      <div ref={ref} className="poll-graphic poll-graphic-scroll">
        {candidates.length ? (
          <svg
            viewBox={`0 0 ${chartWidth} 348`}
            role="group"
            aria-label={`Évolution lissée des intentions de vote de ${candidates.map((candidate) => candidate.name).join(", ")}.`}
          >
            {Array.from({ length: 5 }, (_, index) => (ymax * index) / 4).map((value) => (
              <g key={value}>
                <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="poll-grid" />
                <text x={left - 7} y={y(value) + 4} textAnchor="end">
                  {value}%
                </text>
              </g>
            ))}
            {ticks.map((day) => (
              <text
                key={day}
                x={x(day)}
                y={bottom + 24}
                textAnchor={day === 0 ? "start" : day === POLL_DAYS ? "end" : "middle"}
              >
                {formatShortDate(dayToIso(day))}
              </text>
            ))}
            {plottedEvents.map((event, index) => (
              <a
                key={event.id}
                href={sitePath(`/events/${event.id}`)}
                className="poll-event-marker"
                aria-label={event.title}
                onPointerEnter={(pointerEvent) => revealEvent(event, pointerEvent.currentTarget)}
                onPointerLeave={() => setHoveredEvent(null)}
                onFocus={(focusEvent) => revealEvent(event, focusEvent.currentTarget)}
                onBlur={() => setHoveredEvent(null)}
              >
                <title>{event.title}</title>
                <line x1={x(event.pollDay)} x2={x(event.pollDay)} y1={top} y2={bottom} />
                <circle
                  cx={x(event.pollDay)}
                  cy={bottom + 41 + (index % 2) * 10}
                  r="6"
                  fill={event.color}
                />
              </a>
            ))}
            {data.map(({ candidate, points }, index) => {
              let connected = false;
              const path = points
                .map((point) => {
                  if (point.value === null) {
                    connected = false;
                    return "";
                  }
                  const command = `${connected ? "L" : "M"}${x(point.day).toFixed(1)},${y(point.value).toFixed(1)}`;
                  connected = true;
                  return command;
                })
                .join(" ");
              const last = points.filter((point) => point.value !== null).at(-1);
              return (
                <g key={candidate.id}>
                  <path d={path} fill="none" stroke={candidate.color} strokeWidth="2.8" strokeDasharray={DASHES[index % DASHES.length]} />
                  {points.map(
                    (point) =>
                      point.value !== null && (
                        <circle
                          key={`smooth-${candidate.id}-${point.day}`}
                          className="poll-point-hit"
                          cx={x(point.day).toFixed(2)}
                          cy={y(point.value).toFixed(2)} // fixed precision: server and browser differ in the last float digit
                          r="7"
                          onPointerEnter={(pointerEvent) => hover(candidate, point, pointerEvent.currentTarget, pointerEvent)}
                          onPointerLeave={unhover}
                          onFocus={(focusEvent) => hover(candidate, point, focusEvent.currentTarget)}
                          onBlur={unhover}
                          onClick={(event) => {
                            const poll = pollObservations.find((observation) => observation.day === point.day && observation.values[candidate.id] !== undefined) ?? null;
                            if (poll) selectPoll(poll, candidate.name, candidate.id, event.currentTarget);
                          }}
                        >
                          <title>{`${candidate.name} · ${formatShortDate(dayToIso(point.day))} · ${formatPct(point.value)}`}</title>
                        </circle>
                      ),
                  )}
                  {pollObservations
                    .filter((poll) => poll.values[candidate.id] !== undefined)
                    .map((poll) => {
                      const observedPoint = { day: poll.day, value: poll.values[candidate.id]! };
                      return (
                        <circle
                          key={`${candidate.id}-${poll.id}`}
                          className="poll-observation-hit"
                          cx={x(poll.day)}
                          cy={y(observedPoint.value)}
                          r="5"
                          fill={candidate.color}
                          onPointerEnter={(pointerEvent) => hover(candidate, observedPoint, pointerEvent.currentTarget, pointerEvent)}
                          onPointerLeave={unhover}
                          onFocus={(focusEvent) => hover(candidate, observedPoint, focusEvent.currentTarget)}
                          onBlur={unhover}
                          onClick={(event) => selectPoll(poll, candidate.name, candidate.id, event.currentTarget)}
                        >
                          <title>{`${candidate.name} · ${formatShortDate(poll.fieldworkEnd)} · ${formatPct(observedPoint.value)} % · ${poll.pollster}`}</title>
                        </circle>
                      );
                    })}
                  {last && (
                    <line
                      x1={x(last.day) + 2}
                      x2={right + 5}
                      y1={y(last.value!)}
                      y2={endpoints.find((point) => point.id === candidate.id)?.labelY ?? y(last.value!)}
                      stroke={candidate.color}
                      strokeWidth=".7"
                      strokeDasharray="2 3"
                    />
                  )}
                  {last && (
                    <text x={right + 8} y={(endpoints.find((point) => point.id === candidate.id)?.labelY ?? y(last.value!)) + 4} className="poll-end-label">
                      {candidate.short} {formatPct(last.value!)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <p className="empty-state">Choisissez au moins un candidat pour afficher sa courbe.</p>
        )}
        {hoveredEvent && (
          <div className="poll-event-hovercard" style={{ left: hoveredEvent.x }} role="status">
            {hoveredEvent.title}
          </div>
        )}
        {hoveredPoint && (
          <div
            className="poll-point-hovercard"
            style={{ left: hoveredPoint.x, top: hoveredPoint.y }}
            role="status"
          >
            <strong>{hoveredPoint.candidate}</strong>
            <span>{hoveredPoint.date} · {formatPct(hoveredPoint.value)} %</span>
          </div>
        )}
        {selectedPoll && (
          <aside ref={sourceCardRef} className="poll-source-card" data-side={selectedPoll.side} data-pinned={selectedPoll.pinned} style={{ left: selectedPoll.x, top: selectedPoll.y }} aria-label="Détail du sondage sélectionné">
            <div>
              <strong>{selectedPoll.candidate}</strong>
              <span>{formatShortDate(selectedPoll.observation.fieldworkEnd)} · {formatPct(selectedPoll.observation.values[selectedPoll.candidateId] ?? 0)} %</span>
              <span>{selectedPoll.observation.pollster}</span>
            </div>
            <a href={selectedPoll.observation.source.url} target="_blank" rel="noreferrer" aria-label={`Ouvrir la source du sondage ${selectedPoll.observation.pollster}`} title="Ouvrir la source">↗</a>
          </aside>
        )}
      </div>
    </div>
  );
}
