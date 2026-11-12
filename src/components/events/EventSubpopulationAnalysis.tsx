"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { rankedSegments, type RankedSegment } from "../../lib/radar/highlights";
import { pct, reactionText } from "../../lib/radar/labels";
import { pollCandidates } from "../../data/chartData";

function Reactions({ group }: { group: RankedSegment }) {
  const { contrast, signals } = group;
  return (
    <div className="event-analysis-response">
      <p className="event-analysis-context">Répartition des réponses du groupe dans la simulation.</p>
      <ul className="event-analysis-reactions">
        {signals.slice(0, 4).map((signal) => (
          <li key={signal.bloc + signal.direction} data-dir={signal.direction}>
            <b>{pct(signal.count, signal.sampled)}</b>
            {signal.direction === "toward" ? (
              <ArrowUpRight size={18} aria-hidden="true" />
            ) : (
              <ArrowDownRight size={18} aria-hidden="true" />
            )}
            <span>{reactionText(signal.bloc, signal.direction)}</span>
          </li>
        ))}
      </ul>
      <details className="analysis-method">
        <summary>Comprendre les réponses</summary>
        <p>
          {contrast.sampledCount} profils synthétiques ont été comparés avec et sans l’événement.
          Les groupes sont exploratoires et peuvent se recouper.
        </p>
      </details>
    </div>
  );
}

function ReactionFlow({ group }: { group: RankedSegment }) {
  const levels = group.contrast.candidateLevels;
  const transitions = group.contrast.candidateTransitions;
  if (!levels || !transitions) return null;
  const labels = Object.fromEntries([...pollCandidates.map((candidate) => [candidate.id, candidate.short]), ["abstention", "Abstention"]]);
  const keys = [...pollCandidates.map((candidate) => candidate.id), "abstention"].filter((key) => levels[key] && labels[key]);
  const flows = keys.flatMap((from) => keys.map((to) => ({ from, to, count: transitions[from]?.[to] ?? 0 }))).filter((flow) => flow.count > 0).sort((a, b) => b.count - a.count).slice(0, 16);
  if (!keys.length || !flows.length) return null;
  const rowHeight = 27;
  const barY = 38;
  const barHeight = 28;
  const flowTop = 114;
  const height = flowTop + keys.length * rowHeight + 24;
  const y = (key: string) => flowTop + keys.indexOf(key) * rowHeight + 13;
  const barWidth = 220;
  const flowWidth = (value: number) => Math.max(1.5, (value / group.contrast.sampledCount) * 110);
  const valueLabel = (value: number) => `${(value * 100).toFixed(1)} %`;
  const candidateColors = Object.fromEntries(pollCandidates.map((candidate) => [candidate.id, candidate.color]));
  const segmentColor = (key: string) => key === "abstention" ? "#89928e" : candidateColors[key];
  const stack = (world: "before" | "after") => {
    let cursor = 0;
    return keys.map((key) => {
      const x = cursor;
      cursor += levels[key][world] * barWidth;
      return { key, x, width: levels[key][world] * barWidth };
    });
  };
  return (
    <div className="event-reaction-flow" aria-label="Flux parallèles des intentions de vote simulées">
      <div className="event-reaction-flow-head"><span>Avant l’événement</span><span>Après l’événement</span></div>
      <svg viewBox={`0 0 720 ${height}`} role="img" aria-label="Flux de profils simulés entre catégories de candidats avant et après l’événement">
        <text x="22" y="24" className="event-reaction-flow-axis">Vecteur complet · avant</text>
        <text x="500" y="24" className="event-reaction-flow-axis">Vecteur complet · après</text>
        <g aria-label="Vecteur avant l’événement">
          {stack("before").map(({ key, x, width }) => (
            <g key={`before-${key}`}>
              <rect x={160 + x} y={barY} width={width} height={barHeight} fill={segmentColor(key)} />
              {width > 24 && <text x={160 + x + width / 2} y={barY + 19} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].before)}</text>}
            </g>
          ))}
        </g>
        <g aria-label="Vecteur après l’événement">
          {stack("after").map(({ key, x, width }) => (
            <g key={`after-${key}`}>
              <rect x={500 + x} y={barY} width={width} height={barHeight} fill={segmentColor(key)} />
              {width > 24 && <text x={500 + x + width / 2} y={barY + 19} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].after)}</text>}
            </g>
          ))}
        </g>
        {keys.map((key) => (
          <g key={key}>
            <rect x="164" y={y(key) - 5} width="10" height="10" rx="2" fill={segmentColor(key)} />
            <rect x="504" y={y(key) - 5} width="10" height="10" rx="2" fill={segmentColor(key)} />
            <text x="154" y={y(key) + 4} textAnchor="end" className="event-reaction-flow-label">{labels[key]} · {valueLabel(levels[key].before)}</text>
            <text x="524" y={y(key) + 4} className="event-reaction-flow-label">{labels[key]} · {valueLabel(levels[key].after)}</text>
          </g>
        ))}
        {flows.map(({ from, to, count }) => {
          const color = from === to ? "#89928e" : "var(--orange)";
          return (
            <g key={`${from}-${to}`}>
              <path d={`M180 ${y(from)} C290 ${y(from)}, 400 ${y(to)}, 510 ${y(to)}`} fill="none" stroke={color} strokeOpacity=".55" strokeWidth={flowWidth(count)} />
            </g>
          );
        })}
      </svg>
      <small>Les barres montrent le vecteur complet moyen des intentions simulées. Les rubans représentent les changements de catégorie les plus fréquents ; ce ne sont pas des parts de vote observées.</small>
    </div>
  );
}

function Group({ group }: { group: RankedSegment }) {
  return (
    <div className="event-analysis-segment">
      <p>{group.segment.mechanism}</p>
      <Reactions group={group} />
    </div>
  );
}

export function EventSubpopulationAnalysis({
  analysis,
  showAlternative = false,
}: {
  analysis: AnalysisArtifact | null;
  showAlternative?: boolean;
}) {
  const groups = rankedSegments(analysis);
  const [index, setIndex] = useState(0);
  const alternative = showAlternative ? analysis?.alternative : null;
  return (
    <>
      <section className="event-subpopulation" id="analyse-des-publics">
        <div className="event-subpopulation-heading">
          <div>
            <span className="news-kicker">Qui est concerné ?</span>
            <h2>Groupes les plus touchés</h2>
          </div>
        </div>
        {!analysis || !groups.length ? (
          <p className="event-analysis-caveat">Aucune analyse n’est disponible pour cet événement.</p>
        ) : (
          <div className="event-analysis-results">
            <div className="event-analysis-group-tabs" role="tablist" aria-label="Groupes analysés">
              {groups.map((group, groupIndex) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={groupIndex === index}
                  className={groupIndex === index ? "is-active" : undefined}
                  key={group.segment.id}
                  onClick={() => setIndex(groupIndex)}
                >
                  <span>{groupIndex + 1}</span>{group.segment.name}
                </button>
              ))}
            </div>
            <Group key={groups[index].segment.id} group={groups[index]} />
            <ReactionFlow group={groups[index]} />
          </div>
        )}
      </section>
      {alternative && (
        <section className="event-alternative" aria-labelledby="alt-title">
          <span className="news-kicker">SCÉNARIO ALTERNATIF</span>
          <h2 id="alt-title">Et si l’événement s’était déroulé autrement ?</h2>
          <p>{alternative.description}</p>
          <p className="event-alternative-diff">
            <b>Ce qui change :</b> {alternative.whatChanges}
          </p>
        </section>
      )}
    </>
  );
}
