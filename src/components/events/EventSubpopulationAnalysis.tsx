"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Info } from "lucide-react";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { blocLabels, rankedSegments, type RankedSegment } from "../../lib/radar/highlights";
import { pct, reactionText } from "../../lib/radar/labels";

const points = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pt`;

function Reactions({ group }: { group: RankedSegment }) {
  const { contrast, signals } = group;
  const effects = Object.entries(contrast.effect ?? {}).filter(([, e]) => e.stable).sort((a, b) => Math.abs(b[1].mean) - Math.abs(a[1].mean)).slice(0, 3);
  return <div className="event-analysis-response">
    <strong>Réactions les plus nettes</strong>
    <p className="event-analysis-context">Part des profils de ce groupe dont l’intention change, par rapport à un monde sans cet événement.</p>
    <ul className="event-analysis-reactions">{signals.slice(0, 4).map((s) => <li key={s.bloc + s.direction} data-dir={s.direction}>
      <b>{pct(s.count, s.sampled)}</b>
      {s.direction === "toward" ? <ArrowUpRight size={18} aria-hidden="true" /> : <ArrowDownRight size={18} aria-hidden="true" />}
      <span>{reactionText(s.bloc, s.direction)}</span>
    </li>)}</ul>
    <div className="event-analysis-effect">
      <details><summary aria-label="Comment l’effet est estimé"><span>Effet estimé</span><Info size={14} aria-hidden="true" /></summary>
        <p className="event-analysis-formula">Effet = P(vote | avec l’événement) − P(vote | sans l’événement)</p>
        <p>Différence entre deux distributions de vote simulées sur des profils synthétiques, avec intervalle de bootstrap à 95 %. Hypothèse non validée par des réponses humaines ; ce n’est pas une prévision de vote.</p>
      </details>
      <span>{effects.length ? effects.map(([bloc, e]) => `${blocLabels[bloc] ?? bloc} ${points(e.mean)}`).join(" · ") : "Aucun effet stable détecté"}</span>
    </div>
  </div>;
}

function Group({ group }: { group: RankedSegment }) {
  const { segment } = group;
  return <div className="event-analysis-segment">
    <div className="event-analysis-segment-title"><h3>{segment.name}</h3></div>
    <p>{segment.mechanism}</p>
    <Reactions group={group} />
  </div>;
}

export function EventSubpopulationAnalysis({ analysis }: { analysis: AnalysisArtifact | null }) {
  const groups = rankedSegments(analysis);
  const [i, setI] = useState(0);
  return <>
  <section className="event-subpopulation" id="analyse-des-publics">
    <div className="event-subpopulation-heading"><div><span className="news-kicker"><span /> Qui est concerné ?</span><h2>Groupes les plus touchés</h2></div></div>
    {!analysis || !groups.length ? <p className="event-analysis-caveat">Analyse non disponible pour cet événement. Les analyses sont calculées hors ligne, relues, puis publiées ; aucune n’est lancée depuis cette page.</p> : <div className="event-analysis-results">
      {analysis.demo ? <p className="event-analysis-warning">Analyse calculée sur un événement de démonstration, sans source vérifiable.</p> : null}
      <Group key={i} group={groups[i]} />
      {groups.length > 1 ? <div className="event-analysis-carousel">
        <button type="button" onClick={() => setI((i + groups.length - 1) % groups.length)} aria-label="Groupe précédent"><ChevronLeft size={16} /></button>
        <span>{groups.map((_, k) => <i key={k} data-on={k === i} />)}</span>
        <button type="button" onClick={() => setI((i + 1) % groups.length)} aria-label="Groupe suivant"><ChevronRight size={16} /></button>
      </div> : null}
    </div>}
  </section>
  {analysis?.alternative ? <section className="event-alternative" aria-labelledby="alt-title">
    <span className="news-kicker"><span /> SCÉNARIO ALTERNATIF LE PLUS PROCHE</span>
    <h2 id="alt-title">Et si l’événement s’était déroulé autrement ?</h2>
    <p>{analysis.alternative.description}</p>
    <p className="event-alternative-diff"><b>Ce qui change :</b> {analysis.alternative.whatChanges}</p>
  </section> : null}
  </>;
}
