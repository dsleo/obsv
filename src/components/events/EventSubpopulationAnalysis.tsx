"use client";

import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
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
  return (
    <div className="event-reaction-flow" aria-label="Mouvements directionnels les plus fréquents">
      <div className="event-reaction-flow-head"><span>Sans l’événement</span><span>Avec l’événement</span></div>
      {strongest.map((signal) => (
        <div className="event-reaction-flow-row" key={`${signal.bloc}-${signal.direction}`}>
          <span className="event-reaction-flow-label">{signal.label}</span>
          <div className={`event-reaction-flow-track ${signal.direction}`}>
            <i style={{ width: `${Math.max(8, (signal.count / group.contrast.sampledCount) * 100)}%` }} />
          </div>
          <b>{pct(signal.count, signal.sampled)}</b>
        </div>
      ))}
      <small>Part des profils simulés devenant plus ou moins enclins à choisir ce bloc ; ce n’est pas une part de vote.</small>
    </div>
  );
}

function Group({ group }: { group: RankedSegment }) {
  return (
    <div className="event-analysis-segment">
      <div className="event-analysis-segment-title">
        <h3>{group.segment.name}</h3>
      </div>
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
            {groups.length > 1 && (
              <div className="event-analysis-carousel">
                <button
                  type="button"
                  onClick={() => setIndex((value) => (value + groups.length - 1) % groups.length)}
                  aria-label="Groupe précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {groups.map((_, dot) => (
                    <i key={dot} data-on={dot === index} />
                  ))}
                </span>
                <span className="sr-only">Groupe {index + 1} sur {groups.length}</span>
                <button
                  type="button"
                  onClick={() => setIndex((value) => (value + 1) % groups.length)}
                  aria-label="Groupe suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
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
