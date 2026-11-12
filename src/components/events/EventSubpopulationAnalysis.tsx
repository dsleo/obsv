"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { rankedSegments, type RankedSegment } from "../../lib/radar/highlights";
import { pct, reactionText } from "../../lib/radar/labels";

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
  const strongest = group.signals.slice(0, 3);
  if (!strongest.length) return null;
  const rowHeight = 68;
  const height = strongest.length * rowHeight + 48;
  return (
    <div className="event-reaction-flow" aria-label="Flux parallèles des mouvements directionnels les plus fréquents">
      <div className="event-reaction-flow-head"><span>Avant l’événement</span><span>Après l’événement</span></div>
      <svg viewBox={`0 0 720 ${height}`} role="img" aria-label="Flux de profils simulés avant et après l’événement">
        <text x="22" y="22" className="event-reaction-flow-axis">Intention simulée</text>
        <text x="468" y="22" className="event-reaction-flow-axis">Mouvement observé</text>
        <rect x="22" y="34" width="220" height={height - 50} rx="3" className="event-reaction-flow-source" />
        <text x="132" y={height / 2 + 4} textAnchor="middle" className="event-reaction-flow-source-label">Profils du groupe</text>
        {strongest.map((signal, index) => {
          const y = 58 + index * rowHeight;
          const width = Math.max(8, (signal.count / group.contrast.sampledCount) * 96);
          const color = signal.direction === "toward" ? "var(--orange)" : "#9aa39e";
          return (
            <g key={`${signal.bloc}-${signal.direction}`}>
              <path d={`M242 ${height / 2} C330 ${height / 2}, 350 ${y + 8}, 430 ${y + 8}`} fill="none" stroke={color} strokeOpacity=".72" strokeWidth={width} />
              <rect x="430" y={y - 4} width="18" height="24" rx="2" fill={color} />
              <text x="462" y={y + 12} className="event-reaction-flow-label">{signal.label}</text>
              <text x="690" y={y + 12} textAnchor="end" className="event-reaction-flow-value">{pct(signal.count, signal.sampled)}</text>
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
