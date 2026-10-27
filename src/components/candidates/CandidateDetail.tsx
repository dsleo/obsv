import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pollCandidates, radarEvents, type RadarEvent } from "../../data/radarData";
import { blocLabels, blocSignal, candidateBloc } from "../../lib/radar/highlights";
import { loadAnalysis } from "../../lib/radar/loadAnalysis";
import { getSmoothedPollValue } from "../../lib/chart";
import { CandidateChart } from "./CandidateChart";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

type Signal = { event: RadarEvent; toward: number; away: number; sampled: number };

function ImpactList({ rows, kind }: { rows: Signal[]; kind: "gain" | "loss" }) {
  return (
    <div className="candidate-impact-list">
      {rows.length ? rows.map(({ event, toward, away, sampled }) => <Link className="candidate-impact-row" href={`/events/${event.id}`} key={event.id}>
        <time>{event.shortDate}</time><span><small>{event.tag}</small><strong>{event.title}</strong></span><b className={kind === "gain" ? "candidate-up" : "candidate-down"}>{kind === "gain" ? toward : away}/{sampled} <small>{kind === "gain" ? "vers" : "s’éloignent"}</small></b>
      </Link>) : <p className="candidate-impact-empty">Aucun signal {kind === "gain" ? "de rapprochement" : "d’éloignement"} dans les analyses.</p>}
    </div>
  );
}

export function CandidateDetail({ candidateId }: { candidateId: string }) {
  const candidate = pollCandidates.find((entry) => entry.id === candidateId);
  if (!candidate) return null;

  const first = getSmoothedPollValue(candidate.id, 0) ?? candidate.base;
  const current = getSmoothedPollValue(candidate.id, 91) ?? candidate.base;
  const netChange = current - first;
  const bloc = candidateBloc[candidate.id];
  const signals = radarEvents.flatMap((event): Signal[] => {
    const signal = blocSignal(loadAnalysis(event.id), bloc);
    return signal ? [{ event, ...signal }] : [];
  });
  const gains = signals.filter((s) => s.toward > s.away).sort((a, b) => (b.toward - b.away) - (a.toward - a.away));
  const losses = signals.filter((s) => s.away > s.toward).sort((a, b) => (b.away - b.toward) - (a.away - a.toward));

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
          <div className="candidate-section-heading"><h2>Les événements qui ont compté</h2><span>Signaux de l’analyse · bloc {blocLabels[bloc]}</span></div>
          <div className="candidate-impact-columns">
            <section><h3>Progressions</h3><ImpactList rows={gains} kind="gain" /></section>
            <section><h3>Reculs</h3><ImpactList rows={losses} kind="loss" /></section>
          </div>
          <p className="candidate-data-note">Nombre de profils synthétiques échantillonnés dont l’inclination va vers ce bloc ou s’en éloigne, par rapport au scénario comparé de chaque analyse. Ce n’est ni un sondage, ni une variation en points, ni un effet causal ; le bloc regroupe les candidats proches, pas un candidat seul.</p>
        </section>
      </article>
    </main>
  );
}
