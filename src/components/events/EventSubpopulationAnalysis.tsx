"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
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
  const flowRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ key: string; x: number; y: number } | null>(null);
  const levels = group.contrast.candidateLevels;
  const candidateSummary = group.contrast.candidateSummary;
  if (!levels) return null;
  const labels = Object.fromEntries([...pollCandidates.map((candidate) => [candidate.id, candidate.short]), ["abstention", "Abstention"]]);
  const keys = [...pollCandidates.map((candidate) => candidate.id), "abstention"].filter((key) => levels[key] && labels[key]);
  const orderedKeys = [...keys].sort((a, b) => {
    const aMax = Math.max(levels[a].before, levels[a].after);
    const bMax = Math.max(levels[b].before, levels[b].after);
    return bMax - aMax;
  });
  if (!keys.length) return null;
  const barY = 38;
  const barHeight = 292;
  const barWidth = 46;
  const height = 378;
  const valueLabel = (value: number) => `${(value * 100).toFixed(1)} %`;
  const deltaLabel = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} pt`;
  const candidateColors = Object.fromEntries(pollCandidates.map((candidate) => [candidate.id, candidate.color]));
  const segmentColor = (key: string) => key === "abstention" ? "#89928e" : candidateColors[key];
  const stack = (world: "before" | "after") => {
    let cursor = barY;
    return orderedKeys.map((key) => {
      const height = levels[key][world] * barHeight;
      const y = cursor;
      cursor += height;
      return { key, y, height };
    });
  };
  const beforeStack = stack("before");
  const afterStack = stack("after");
  const beforeY = Object.fromEntries(beforeStack.map((segment) => [segment.key, segment.y + segment.height / 2]));
  const afterY = Object.fromEntries(afterStack.map((segment) => [segment.key, segment.y + segment.height / 2]));
  const reveal = (key: string, target: SVGGraphicsElement) => {
    if (!flowRef.current) return;
    const root = flowRef.current.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const x = rect.left - root.left + rect.width / 2;
    const y = rect.top - root.top + rect.height / 2;
    setHovered({
      key,
      x: Math.max(72, Math.min(root.width - 72, x)),
      y: Math.max(26, Math.min(root.height - 26, y)),
    });
  };
  const profileRows = candidateSummary
    ? keys
      .map((key) => ({ key, toward: candidateSummary[key]?.toward ?? 0, away: candidateSummary[key]?.away ?? 0 }))
      .filter((row) => row.toward > 0 || row.away > 0)
      .sort((a, b) => Math.max(b.toward, b.away) - Math.max(a.toward, a.away))
    : [];
  return (
    <div ref={flowRef} className="event-reaction-flow" aria-label="Répartition des intentions de vote simulées avant et après l’événement">
      <div className="event-reaction-flow-head"><span>Sans l’événement</span><span>Écart moyen</span><span>Avec l’événement</span></div>
      <svg viewBox={`0 0 720 ${height}`} role="img" aria-label="Répartition moyenne des intentions de vote simulées avant et après l’événement">
        {beforeStack.map(({ key, y, height: segmentHeight }) => (
          <g key={`before-${key}`}>
            <rect x="160" y={y} width={barWidth} height={segmentHeight} fill={segmentColor(key)} onMouseEnter={(event) => reveal(key, event.currentTarget)} onMouseLeave={() => setHovered(null)} onFocus={(event) => reveal(key, event.currentTarget)} onBlur={() => setHovered(null)}>
              <title>{`${labels[key]} · ${valueLabel(levels[key].before)} · ${deltaLabel(levels[key].change)}`}</title>
            </rect>
            {segmentHeight > 22 && <text x="183" y={y + segmentHeight / 2 + 4} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].before)}</text>}
            {segmentHeight > 16 && <text x="150" y={y + segmentHeight / 2 + 4} textAnchor="end" className="event-reaction-flow-label">{labels[key]}</text>}
          </g>
        ))}
        {afterStack.map(({ key, y, height: segmentHeight }) => (
          <g key={`after-${key}`}>
            <rect x="514" y={y} width={barWidth} height={segmentHeight} fill={segmentColor(key)} onMouseEnter={(event) => reveal(key, event.currentTarget)} onMouseLeave={() => setHovered(null)} onFocus={(event) => reveal(key, event.currentTarget)} onBlur={() => setHovered(null)}>
              <title>{`${labels[key]} · ${valueLabel(levels[key].after)} · ${deltaLabel(levels[key].change)}`}</title>
            </rect>
            {segmentHeight > 22 && <text x="537" y={y + segmentHeight / 2 + 4} textAnchor="middle" className="event-reaction-flow-bar-value">{valueLabel(levels[key].after)}</text>}
            {segmentHeight > 16 && <text x="570" y={y + segmentHeight / 2 + 4} className="event-reaction-flow-label">{labels[key]}</text>}
          </g>
        ))}
        {orderedKeys.map((key) => Math.abs(levels[key].change) >= 0.005 && (
          <text key={`delta-${key}`} x="360" y={(beforeY[key] + afterY[key]) / 2 + 4} textAnchor="middle" className={`event-reaction-flow-delta ${levels[key].change >= 0 ? "is-up" : "is-down"}`}>
            {deltaLabel(levels[key].change)}
          </text>
        ))}
        <text x="183" y={barY + barHeight + 20} textAnchor="middle" className="event-reaction-flow-axis">Sans</text>
        <text x="537" y={barY + barHeight + 20} textAnchor="middle" className="event-reaction-flow-axis">Avec</text>
      </svg>
      {hovered && <div className="event-flow-tooltip" style={{ left: hovered.x, top: hovered.y }} role="status">
        <strong>{labels[hovered.key]}</strong>
        <span>Avant&nbsp; {valueLabel(levels[hovered.key].before)}</span>
        <span>Après&nbsp; {valueLabel(levels[hovered.key].after)}</span>
        <span className={levels[hovered.key].change >= 0 ? "is-up" : "is-down"}>{deltaLabel(levels[hovered.key].change)}</span>
        {candidateSummary?.[hovered.key] && <><span>Plus enclins&nbsp; {pct(candidateSummary[hovered.key].toward, group.contrast.sampledCount)}</span><span>Moins enclins&nbsp; {pct(candidateSummary[hovered.key].away, group.contrast.sampledCount)}</span></>}
      </div>}
      {profileRows.length > 0 && <div className="event-profile-shifts">
        <div className="event-profile-shifts-head"><div><h3>Profils plus ou moins enclins</h3><p>Part des profils dont la propension change d’au moins 2 points.</p></div><span>{group.contrast.sampledCount} profils</span></div>
        <div className="event-profile-shift-grid"><span>Candidat</span><span>Plus</span><span>Moins</span></div>
        <div className="event-profile-shift-list">{profileRows.slice(0, 6).map(({ key, toward, away }) => (
          <div className="event-profile-shift-row" key={key}>
            <strong>{labels[key]}</strong>
            <span className="event-profile-shift-stat is-up"><ArrowUpRight size={14} aria-hidden="true" />{pct(toward, group.contrast.sampledCount)}</span>
            <span className="event-profile-shift-stat is-down"><ArrowDownRight size={14} aria-hidden="true" />{pct(away, group.contrast.sampledCount)}</span>
          </div>
        ))}</div>
        {profileRows.length > 6 && <details className="event-profile-shift-more"><summary>Voir tous les candidats</summary><div className="event-profile-shift-list">{profileRows.slice(6).map(({ key, toward, away }) => (
          <div className="event-profile-shift-row" key={key}>
            <strong>{labels[key]}</strong>
            <span className="event-profile-shift-stat is-up"><ArrowUpRight size={14} aria-hidden="true" />{pct(toward, group.contrast.sampledCount)}</span>
            <span className="event-profile-shift-stat is-down"><ArrowDownRight size={14} aria-hidden="true" />{pct(away, group.contrast.sampledCount)}</span>
          </div>
        ))}</div></details>}
      </div>}
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
