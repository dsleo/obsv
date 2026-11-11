"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { pct } from "../../lib/radar/labels";

export type ImpactRow = { id: string; title: string; tag: string; shortDate: string; pollDay: number; toward: number; away: number; sampled: number };

const TOP = 5;

function List({ rows: all, kind }: { rows: ImpactRow[]; kind: "gain" | "loss" }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? all : all.slice(0, TOP);
  if (!rows.length) return <p className="candidate-impact-empty">Aucun signal {kind === "gain" ? "de rapprochement" : "d’éloignement"} dans les analyses.</p>;
  return <><div className="candidate-impact-list">{rows.map((r) => {
    const n = kind === "gain" ? r.toward : r.away;
    return <Link className="candidate-impact-row" href={`/events/${r.id}`} key={r.id} title={r.title}>
      <time>{r.shortDate}</time>
      <span>{r.tag ? <small>{r.tag}</small> : null}<strong>{r.title}</strong></span>
      <b className={kind === "gain" ? "candidate-up" : "candidate-down"} title={`${n} profils sur ${r.sampled}`}>{pct(n, r.sampled)}<small>{kind === "gain" ? "plus enclins" : "moins enclins"}</small></b>
    </Link>;
  })}</div>
  {all.length > TOP ? <button type="button" className="article-more" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={expanded ? "Réduire la liste" : `Voir les ${all.length - TOP} autres événements`} title={expanded ? "Réduire" : `${all.length - TOP} autres`}>{expanded ? <ChevronUp size={20} /> : <><ChevronDown size={20} /><small>+{all.length - TOP}</small></>}</button> : null}</>;
}

/** Events that moved this bloc's synthetic profiles, sortable by impact (share of profiles) or by date. */
export function CandidateImpacts({ rows }: { rows: ImpactRow[] }) {
  const [order, setOrder] = useState<"impact" | "date">("impact");
  const share = (r: ImpactRow, kind: "gain" | "loss") => (kind === "gain" ? r.toward : r.away) / r.sampled; // the percentage shown on the row
  const sort = (list: ImpactRow[], kind: "gain" | "loss") => [...list].sort((a, b) => order === "date" ? b.pollDay - a.pollDay : share(b, kind) - share(a, kind));
  const MIN = 0.02; // below 2 % of profiles the signal is noise: not listed
  const gains = sort(rows.filter((r) => r.toward > r.away && share(r, "gain") >= MIN), "gain"), losses = sort(rows.filter((r) => r.away > r.toward && share(r, "loss") >= MIN), "loss");
  return <>
    <div className="candidate-section-heading"><h2>Les événements qui ont compté</h2>
      <div className="candidate-sort" role="group" aria-label="Trier les événements">
        <span>Trier par</span>
        {(["impact", "date"] as const).map((o) => <button type="button" key={o} aria-pressed={order === o} onClick={() => setOrder(o)}>{o === "impact" ? "Impact" : "Date"}</button>)}
      </div>
    </div>
    <div className="candidate-impact-columns">
      <section><h3>Progressions</h3><List rows={gains} kind="gain" /></section>
      <section><h3>Reculs</h3><List rows={losses} kind="loss" /></section>
    </div>
  </>;
}
