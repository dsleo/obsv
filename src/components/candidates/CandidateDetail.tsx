import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  candidateLatestDate,
  dayToIso,
  FIRST_POLL_DAY,
  formatShortDate,
  LAST_POLL_DAY,
  pollCandidates,
  pollWindowLabel,
  radarEvents,
} from "../../data/radarData";
import { blocLabels, blocSignal, candidateBloc } from "../../lib/radar/highlights";
import { loadAnalysis } from "../../lib/radar/loadAnalysis";
import { currentPollValue, formatPct, getSmoothedPollValue } from "../../lib/chart";
import { CandidateChart } from "./CandidateChart";
import { CandidateImpacts, type ImpactRow } from "./CandidateImpacts";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

export function CandidateDetail({ candidateId }: { candidateId: string }) {
  const candidate = pollCandidates.find((entry) => entry.id === candidateId);
  if (!candidate) return null;

  const first = getSmoothedPollValue(candidate.id, FIRST_POLL_DAY);
  const current = currentPollValue(candidate.id);
  const netChange = current !== null && first !== null ? current - first : null;
  const bloc = candidateBloc[candidate.id];
  const rows = radarEvents.flatMap((event): ImpactRow[] => {
    const signal = blocSignal(loadAnalysis(event.id), bloc);
    return signal
      ? [
          {
            id: event.id,
            title: event.title,
            tag: event.tag,
            shortDate: event.shortDate,
            pollDay: event.pollDay,
            ...signal,
          },
        ]
      : [];
  });

  return (
    <main className="news-page candidate-page" id="contenu">
      <NewsMasthead section="CANDIDATS" />
      <article className="candidate-article">
        <Link href="/candidates" className="news-back-link">
          <ArrowLeft size={14} /> Tous les candidats
        </Link>
        <header className="candidate-profile-heading">
          <span className="candidate-party-line">
            <i style={{ backgroundColor: candidate.color }} /> {candidate.party}
          </span>
          <h1>{candidate.name}</h1>
          <div className="candidate-profile-stats">
            <span>
              <small>INTENTIONS DE VOTE</small>
              <strong>{current === null ? "—" : `${formatPct(current)} %`}</strong>
            </span>
            <span>
              <small>
                ÉVOLUTION DEPUIS LE {formatShortDate(dayToIso(FIRST_POLL_DAY)).toUpperCase()}
              </small>
              <strong className={(netChange ?? 0) >= 0 ? "candidate-up" : "candidate-down"}>
                {netChange === null
                  ? "—"
                  : `${netChange >= 0 ? "+" : "−"}${formatPct(Math.abs(netChange))} pts`}
              </strong>
            </span>
          </div>
          <p className="candidate-data-note">
            Dernier terrain pour {candidate.name} :{" "}
            {candidateLatestDate(candidate.id)
              ? formatShortDate(candidateLatestDate(candidate.id)!)
              : "aucun sondage"}
            .
          </p>
        </header>

        <section className="candidate-chart-section">
          <div className="candidate-section-heading">
            <h2>Évolution des intentions de vote</h2>
            <span>{pollWindowLabel}</span>
          </div>
          <CandidateChart candidateId={candidate.id} color={candidate.color} />
        </section>

        <section className="candidate-impacts">
          <p className="candidate-data-note">
            Les réponses ci-dessous concernent le bloc « {blocLabels[bloc]} », qui réunit{" "}
            {pollCandidates
              .filter((c) => candidateBloc[c.id] === bloc)
              .map((c) => c.name)
              .join(", ")}
            . Elles décrivent un échantillon synthétique à l’échelle de l’index, sans additionner
            les groupes qui peuvent se recouper.
          </p>
          <CandidateImpacts rows={rows} />
          <p className="candidate-data-note">
            Part des réponses synthétiques dont l’intention de vote se rapproche de ce bloc (« plus
            enclins ») ou s’en éloigne (« moins enclins »), par rapport à un monde sans l’événement.
            Ce n’est ni un sondage ni un effet mesuré ; le bloc regroupe les candidats proches, pas
            un candidat seul.
          </p>
        </section>
      </article>
    </main>
  );
}
