import Link from "next/link";
import { dayToIso, FIRST_POLL_DAY, formatShortDate, LAST_POLL_DAY, pollCandidates } from "../../data/radarData";
import { formatPct, getSmoothedPollValue } from "../../lib/chart";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

export function CandidatesIndex() {
  const rankedCandidates = [...pollCandidates].sort((a, b) =>
    (getSmoothedPollValue(b.id, LAST_POLL_DAY) ?? 0) - (getSmoothedPollValue(a.id, LAST_POLL_DAY) ?? 0),
  );

  return (
    <main className="news-page candidate-page">
      <NewsMasthead section="CANDIDATS" />
      <div className="candidate-content">
        <header className="candidate-intro">
          <h1>Les candidats <em>en mouvement.</em></h1>
        </header>

        <section className="candidate-roster" aria-label="Candidats classés selon les intentions de vote">
          <div className="candidate-roster-heading"><span>Candidat</span><span>Parti</span><span>Intentions de vote</span></div>
          {rankedCandidates.map((candidate) => {
            const current = getSmoothedPollValue(candidate.id, LAST_POLL_DAY);
            const first = getSmoothedPollValue(candidate.id, FIRST_POLL_DAY);
            const change = current !== null && first !== null ? current - first : null;
            return (
              <Link href={`/candidates/${candidate.id}`} className="candidate-roster-row" key={candidate.id}>
                <span className="candidate-roster-name"><i style={{ backgroundColor: candidate.color }} /><strong>{candidate.name}</strong></span>
                <span className="candidate-party">{candidate.party}</span>
                <span className="candidate-latest"><strong>{current === null ? "—" : `${formatPct(current)} %`}</strong>{change === null ? null : <span className={change >= 0 ? "candidate-up" : "candidate-down"}>{change >= 0 ? "+" : ""}{formatPct(change)} pts depuis le {formatShortDate(dayToIso(FIRST_POLL_DAY))}</span>}<i><b style={{ width: `${Math.min(100, ((current ?? 0) / 40) * 100)}%`, backgroundColor: candidate.color }} /></i></span>
              </Link>
            );
          })}
        </section>
        <p className="candidate-data-note">Moyenne lissée des sondages publiés au premier tour (Sondax, d’après Wikipédia, CC BY-SA 4.0). Un candidat sans sondage récent n’a pas de valeur actuelle.</p>
      </div>
    </main>
  );
}
