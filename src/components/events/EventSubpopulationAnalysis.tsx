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
  const beforeKeys = [...keys].sort((a, b) => levels[b].before - levels[a].before);
  const afterKeys = [...keys].sort((a, b) => levels[b].after - levels[a].after);
  const flows = keys.flatMap((from) => keys.map((to) => ({ from, to, count: transitions[from]?.[to] ?? 0 })))
    .filter((flow) => flow.count > 0 && flow.from !== flow.to)
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
  if (!keys.length) return null;
  const barY = 38;
  const barHeight = 292;
  const barWidth = 46;
  const height = 372;
  const valueLabel = (value: number) => `${(value * 100).toFixed(1)} %`;
  const candidateColors = Object.fromEntries(pollCandidates.map((candidate) => [candidate.id, candidate.color]));
  const segmentColor = (key: string) => key === "abstention" ? "#89928e" : candidateColors[key];
  const stack = (ordered: string[], world: "before" | "after") => {
    let cursor = barY;
    return ordered.map((key) => {
      const height = levels[key][world] * barHeight;
      const y = cursor;
      cursor += height;
      return { key, y, height };
    });
  };
  const beforeStack = stack(beforeKeys, "before");
  const afterStack = stack(afterKeys, "after");
  const beforeY = Object.fromEntries(beforeStack.map((segment) => [segment.key, segment.y + segment.height / 2]));
  const afterY = Object.fromEntries(afterStack.map((segment) => [segment.key, segment.y + segment.height / 2]));
  const sourceTotals = Object.fromEntries(keys.map((key) => [key, Object.values(transitions[key] ?? {}).reduce((sum, count) => sum + count, 0)]));
  return (
    <div className="event-reaction-flow" aria-label="Répartition des intentions de vote simulées avant et après l’événement">
      <div className="event-reaction-flow-head"><span>Avant l’événement</span><span>Après l’événement</span></div>
      <svg viewBox={`0 0 720 ${height}`} role="img" aria-label="Répartition et transitions des intentions de vote simulées">
        {beforeStack.map(({ key, y, height: segmentHeight }) => (
          <g key={`before-${key}`}>
            <rect x="160" y={y} width={barWidth} height={segmentHeight} fill={segmentColor(key)}>
              <title>{`${labels[key]} · ${valueLabel(levels[key].before)}`}</title>
            </rect>
            {segmentHeight > 22 && <text x="183" y={y + segmentHeight / 2 + 4} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].before)}</text>}
          </g>
        ))}
        {afterStack.map(({ key, y, height: segmentHeight }) => (
          <g key={`after-${key}`}>
            <rect x="514" y={y} width={barWidth} height={segmentHeight} fill={segmentColor(key)}>
              <title>{`${labels[key]} · ${valueLabel(levels[key].after)}`}</title>
            </rect>
            {segmentHeight > 22 && <text x="537" y={y + segmentHeight / 2 + 4} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].after)}</text>}
          </g>
        ))}
        {flows.map(({ from, to, count }) => {
          const share = count / Math.max(1, sourceTotals[from]);
          return (
            <path key={`${from}-${to}`} d={`M206 ${beforeY[from]} C320 ${beforeY[from]}, 400 ${afterY[to]}, 514 ${afterY[to]}`} fill="none" stroke="var(--orange)" strokeOpacity=".38" strokeWidth={Math.max(1.5, count / group.contrast.sampledCount * 110)}>
              <title>{`${labels[from]} → ${labels[to]} · ${(share * 100).toFixed(1)} % des profils de départ`}</title>
            </path>
          );
        })}
        <text x="183" y={barY + barHeight + 20} textAnchor="middle" className="event-reaction-flow-axis">Avant</text>
        <text x="537" y={barY + barHeight + 20} textAnchor="middle" className="event-reaction-flow-axis">Après</text>
      </svg>
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
