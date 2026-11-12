"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { rankedSegments, type RankedSegment } from "../../lib/radar/highlights";
import { pct } from "../../lib/radar/labels";
import { pollCandidates } from "../../data/chartData";

function Reactions({ group }: { group: RankedSegment }) {
  const { contrast } = group;
  const candidateLabels = Object.fromEntries([...pollCandidates.map((candidate) => [candidate.id, candidate.short]), ["abstention", "Abstention"]]);
  const signals = contrast.candidateSummary
    ? Object.entries(contrast.candidateSummary)
      .flatMap(([candidate, value]) => [
        { candidate, label: candidateLabels[candidate] ?? candidate, direction: "toward" as const, count: value.toward },
        { candidate, label: candidateLabels[candidate] ?? candidate, direction: "away" as const, count: value.away },
      ])
      .filter((signal) => signal.count > 0)
      .sort((a, b) => b.count - a.count)
    : group.signals.map((signal) => ({ candidate: signal.bloc, label: signal.label, direction: signal.direction, count: signal.count }));
  const reactionText = (candidate: string, label: string, direction: "toward" | "away") => {
    const more = direction === "toward";
    if (candidate === "abstention") return `${more ? "plus" : "moins"} enclins à s’abstenir`;
    return `${more ? "plus" : "moins"} enclins à voter pour ${label}`;
  };
  return (
    <div className="event-analysis-response">
      <p className="event-analysis-context">Évolution simulée des intentions de vote, candidat par candidat.</p>
      <ul className="event-analysis-reactions">
        {signals.slice(0, 4).map((signal) => (
          <li key={signal.candidate + signal.direction} data-dir={signal.direction}>
            <div className="event-analysis-stat">
              <b>{pct(signal.count, contrast.sampledCount)}</b>
              {signal.direction === "toward" ? (
                <ArrowUpRight size={20} strokeWidth={2.4} aria-hidden="true" />
              ) : (
                <ArrowDownRight size={20} strokeWidth={2.4} aria-hidden="true" />
              )}
            </div>
            <span>{reactionText(signal.candidate, signal.label, signal.direction)}</span>
          </li>
        ))}
      </ul>
      <details className="analysis-method">
        <summary>Comprendre les réponses</summary>
        <p>
          Pour chacun des {contrast.sampledCount} profils synthétiques, le modèle estime une distribution complète d’intentions de vote dans deux scénarios : sans l’événement et avec l’événement. Une carte « plus enclins » compte les profils dont la probabilité attribuée à un candidat augmente d’au moins deux points ; « moins enclins » applique le même seuil à la baisse. Ces résultats décrivent une simulation exploratoire, pas un sondage ni un vote observé, et les groupes peuvent se recouper.
        </p>
      </details>
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
                  <span className="event-analysis-group-index">{groupIndex + 1}</span>
                  <span className="event-analysis-group-name">{group.segment.name}</span>
                </button>
              ))}
            </div>
            <Group key={groups[index].segment.id} group={groups[index]} />
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
