import Link from "next/link";
import { pollCandidates, getSmoothedPollValue } from "../../data/radarData";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

export function CandidatesIndex() {
  const rankedCandidates = [...pollCandidates].sort((a, b) =>
    (getSmoothedPollValue(b.id, 91) ?? 0) - (getSmoothedPollValue(a.id, 91) ?? 0),
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
            const current = getSmoothedPollValue(candidate.id, 91) ?? candidate.base;
            const first = getSmoothedPollValue(candidate.id, 0) ?? candidate.base;
            const change = current - first;
            return (
              <Link href={`/candidates/${candidate.id}`} className="candidate-roster-row" key={candidate.id}>
                <span className="candidate-roster-name"><i style={{ backgroundColor: candidate.color }} /><strong>{candidate.name}</strong></span>
                <span className="candidate-party">{candidate.party}</span>
                <span className="candidate-latest"><strong>{current.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</strong><span className={change >= 0 ? "candidate-up" : "candidate-down"}>{change >= 0 ? "+" : ""}{change.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts depuis le 30 juin</span><i><b style={{ width: `${Math.min(100, (current / 35) * 100)}%`, backgroundColor: candidate.color }} /></i></span>
              </Link>
            );
          })}
        </section>
        <p className="candidate-data-note">Les chiffres et les variations présentés reposent sur une série de sondages fictifs.</p>
      </div>
    </main>
  );
}
