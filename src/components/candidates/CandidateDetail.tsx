import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { candidateEventImpacts, pollCandidates, radarEvents, type RadarEvent } from "../../data/radarData";
import { getSmoothedPollValue } from "../../lib/chart";
import { CandidateChart } from "./CandidateChart";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

function ImpactList({ events, impacts, kind }: { events: RadarEvent[]; impacts: Record<string, number>; kind: "gain" | "loss" }) {
  const rows = events
    .map((event) => ({ event, value: impacts[event.id] ?? 0 }))
    .filter(({ value }) => kind === "gain" ? value > 0 : value < 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="candidate-impact-list">
      {rows.length ? rows.map(({ event, value }) => <Link className="candidate-impact-row" href={`/events/${event.id}`} key={event.id}>
        <time>{event.shortDate}</time><span><small>{event.tag}</small><strong>{event.title}</strong></span><b className={value > 0 ? "candidate-up" : "candidate-down"}>{value > 0 ? "+" : "−"}{Math.abs(value).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small>pts</small></b>
      </Link>) : <p className="candidate-impact-empty">Aucun effet {kind === "gain" ? "positif" : "négatif"} dans ce scénario.</p>}
    </div>
  );
}

export function CandidateDetail({ candidateId }: { candidateId: string }) {
  const candidate = pollCandidates.find((entry) => entry.id === candidateId);
  if (!candidate) return null;

  const first = getSmoothedPollValue(candidate.id, 0) ?? candidate.base;
  const current = getSmoothedPollValue(candidate.id, 91) ?? candidate.base;
  const netChange = current - first;
  const impacts = candidateEventImpacts[candidate.id] ?? {};

  return (
    <main className="news-page candidate-page">
      <NewsMasthead section="CANDIDATS" />
      <article className="candidate-article">
        <Link href="/candidates" className="news-back-link"><ArrowLeft size={14} /> Tous les candidats</Link>
        <header className="candidate-profile-heading">
          <span className="candidate-party-line"><i style={{ backgroundColor: candidate.color }} /> {candidate.party}</span>
          <h1>{candidate.name}</h1>
          <div className="candidate-profile-stats"><span><small>INTENTIONS DE VOTE / 29 SEPT.</small><strong>{current.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</strong></span><span><small>ÉVOLUTION DEPUIS LE 30 JUIN</small><strong className={netChange >= 0 ? "candidate-up" : "candidate-down"}>{netChange >= 0 ? "+" : "−"}{Math.abs(netChange).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts</strong></span></div>
        </header>

        <section className="candidate-chart-section">
          <div className="candidate-section-heading"><h2>Évolution des intentions de vote</h2><span>30 JUIN — 29 SEPT. 2026</span></div>
          <CandidateChart candidateId={candidate.id} color={candidate.color} />
          <div className="candidate-event-key">Les repères verticaux indiquent les dates des événements · les points, les sondages</div>
        </section>

        <section className="candidate-impacts">
          <div className="candidate-section-heading"><h2>Les événements qui ont compté</h2><span>Variation estimée des intentions de vote</span></div>
          <div className="candidate-impact-columns">
            <section><h3>Progressions</h3><ImpactList events={radarEvents} impacts={impacts} kind="gain" /></section>
            <section><h3>Reculs</h3><ImpactList events={radarEvents} impacts={impacts} kind="loss" /></section>
          </div>
          <p className="candidate-data-note">Ces variations illustrent le scénario ; elles ne constituent pas des estimations causales tirées de sondages publiés.</p>
        </section>
      </article>
    </main>
  );
}
