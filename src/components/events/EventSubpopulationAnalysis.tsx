"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { useState } from "react";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { rankedSegments, type RankedSegment } from "../../lib/radar/highlights";
import { pct } from "../../lib/radar/labels";
import { pollCandidates } from "../../data/chartData";

const candidateLabels: Record<string, string> = Object.fromEntries([...pollCandidates.map((candidate) => [candidate.id, candidate.short]), ["abstention", "Abstention"]]);
type Signal = { candidate: string; label: string; direction: "toward" | "away"; count: number };

/** One signal per candidate: "plus enclins" and "moins enclins" net out (toward - away); a zero net is dropped. */
function netSignals(group: RankedSegment): Signal[] {
  const net = new Map<string, { label: string; count: number }>();
  const add = (candidate: string, label: string, delta: number) =>
    net.set(candidate, { label, count: (net.get(candidate)?.count ?? 0) + delta });
  const summary = group.contrast.candidateSummary;
  if (summary)
    for (const [candidate, v] of Object.entries(summary)) add(candidate, candidateLabels[candidate] ?? candidate, v.toward - v.away);
  else
    for (const s of group.signals) add(s.bloc, s.label, s.direction === "toward" ? s.count : -s.count);
  return [...net]
    .filter(([, v]) => v.count !== 0)
    .map(([candidate, v]) => ({ candidate, label: v.label, direction: v.count > 0 ? ("toward" as const) : ("away" as const), count: Math.abs(v.count) }))
    .sort((a, b) => b.count - a.count);
}

const METHOD_NOTE = (n: number) =>
  `Pour chacun des ${n} profils synthétiques, le modèle estime une distribution complète d’intentions de vote dans deux scénarios : sans l’événement et avec l’événement. « Plus enclins » compte les profils dont la probabilité attribuée à un candidat augmente d’au moins deux points ; « moins enclins » applique le même seuil à la baisse. Pour un même candidat, les deux sens sont additionnés : seul le solde est affiché. Cliquer sur un solde affiche la réaction du profil qui a le plus bougé dans ce sens. Ces résultats décrivent une simulation exploratoire, pas un sondage ni un vote observé, et les groupes peuvent se recouper.`;

function Reactions({ group }: { group: RankedSegment }) {
  const { contrast } = group;
  const signals = netSignals(group).slice(0, 4);
  const [open, setOpen] = useState<string | null>(null);
  const quoteOf = (signal: Signal) => {
    const q = contrast.quotes?.[signal.candidate];
    return q && q.direction === signal.direction ? q : null;
  };
  const reactionText = (candidate: string, label: string, direction: "toward" | "away") => {
    const more = direction === "toward";
    if (candidate === "abstention") return `${more ? "plus" : "moins"} enclins à s’abstenir`;
    return `${more ? "plus" : "moins"} enclins à voter pour ${label}`;
  };
  const opened = signals.find((signal) => signal.candidate === open);
  const openedQuote = opened ? quoteOf(opened) : null;
  return (
    <div className="event-analysis-response">
      <span className="event-analysis-info" tabIndex={0} role="note" aria-label="Comprendre les réponses">
        <Info size={17} aria-hidden="true" />
        <span className="event-analysis-info-tip">{METHOD_NOTE(contrast.sampledCount)}</span>
      </span>
      <p className="event-analysis-context">Évolution simulée des intentions de vote, candidat par candidat.</p>
      <ul className="event-analysis-reactions">
        {signals.map((signal) => {
          const quote = quoteOf(signal);
          const body = (
            <>
              <div className="event-analysis-stat">
                <b>{pct(signal.count, contrast.sampledCount)}</b>
                {signal.direction === "toward" ? (
                  <ArrowUpRight size={20} strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <ArrowDownRight size={20} strokeWidth={2.4} aria-hidden="true" />
                )}
              </div>
              <span>{reactionText(signal.candidate, signal.label, signal.direction)}</span>
            </>
          );
          return (
            <li key={signal.candidate + signal.direction} data-dir={signal.direction}>
              {quote ? (
                <button type="button" aria-expanded={open === signal.candidate} onClick={() => setOpen(open === signal.candidate ? null : signal.candidate)}>
                  {body}
                </button>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      {openedQuote && (
        <figure className="event-analysis-quote">
          <blockquote>« {openedQuote.text} »</blockquote>
          <figcaption>
            {openedQuote.profile} · {opened!.label} {openedQuote.points > 0 ? "+" : "−"}
            {Math.abs(openedQuote.points)} pts
          </figcaption>
        </figure>
      )}
    </div>
  );
}

/** Short pill label: whole words up to 28 chars, then "…". The full name shows once the group is selected. */
function shortLabel(name: string, max = 28): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max + 1).replace(/\s+\S*$/, "");
  return `${cut || name.slice(0, max)}…`;
}

function Group({ group }: { group: RankedSegment }) {
  return (
    <div className="event-analysis-segment">
      <h3 className="event-analysis-group-title">{group.segment.name}</h3>
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
  const groups = rankedSegments(analysis).filter((group) => netSignals(group).length > 0);
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
                  title={group.segment.name}
                  onClick={() => setIndex(groupIndex)}
                >
                  <span className="event-analysis-group-index">{groupIndex + 1}</span>
                  <span className="event-analysis-group-name">{shortLabel(group.segment.name)}</span>
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
