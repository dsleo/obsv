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
  const keys = Object.keys(levels)
    .filter((key) => labels[key])
    .sort((a, b) => Math.max(levels[b].before, levels[b].after) - Math.max(levels[a].before, levels[a].after))
    .slice(0, 8);
  const flows = keys.flatMap((from) => keys.map((to) => ({ from, to, count: transitions[from]?.[to] ?? 0 }))).filter((flow) => flow.count > 0).sort((a, b) => b.count - a.count).slice(0, 16);
  if (!keys.length || !flows.length) return null;
  const rowHeight = 38;
  const height = keys.length * rowHeight + 58;
  const y = (key: string) => 44 + keys.indexOf(key) * rowHeight + 14;
  const width = (value: number) => Math.max(2, (value / group.contrast.sampledCount) * 150);
  return (
    <div className="event-reaction-flow" aria-label="Flux parallèles des intentions de vote simulées">
      <div className="event-reaction-flow-head"><span>Avant l’événement</span><span>Après l’événement</span></div>
      <svg viewBox={`0 0 720 ${height}`} role="img" aria-label="Flux de profils simulés entre catégories de candidats avant et après l’événement">
        <text x="22" y="24" className="event-reaction-flow-axis">Intention de vote</text>
        <text x="540" y="24" className="event-reaction-flow-axis">Intention de vote</text>
        {keys.map((key) => (
          <g key={key}>
            <rect x="164" y={y(key) - width(levels[key].before) / 2} width="16" height={width(levels[key].before)} rx="2" className="event-reaction-flow-node" />
            <rect x="510" y={y(key) - width(levels[key].after) / 2} width="16" height={width(levels[key].after)} rx="2" className="event-reaction-flow-node after" />
            <text x="154" y={y(key) + 4} textAnchor="end" className="event-reaction-flow-label">{labels[key]}</text>
            <text x="538" y={y(key) + 4} className="event-reaction-flow-label">{labels[key]}</text>
          </g>
        ))}
        {flows.map(({ from, to, count }) => {
          const color = from === to ? "#89928e" : "var(--orange)";
          return (
            <g key={`${from}-${to}`}>
              <path d={`M180 ${y(from)} C290 ${y(from)}, 400 ${y(to)}, 510 ${y(to)}`} fill="none" stroke={color} strokeOpacity=".55" strokeWidth={width(count)} />
            </g>
          );
        })}
      </svg>
      <small>Part des profils simulés devenant plus ou moins enclins à choisir ce bloc ; ce n’est pas une part de vote.</small>
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
