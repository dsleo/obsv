import Link from "next/link";
import {
  candidateLatestDate,
  dayToIso,
  FIRST_POLL_DAY,
  formatShortDate,
  LAST_POLL_DAY,
  pollCandidates,
} from "../../data/radarData";
import { currentPollValue, formatPct, getSmoothedPollValue } from "../../lib/chart";
import { NewsMasthead } from "../events/NewsMasthead";
import "../events/event-pages.css";
import "./candidates.css";

export function CandidatesIndex() {
  const rankedCandidates = [...pollCandidates].sort(
    (a, b) => (currentPollValue(b.id) ?? 0) - (currentPollValue(a.id) ?? 0),
  );

  return (
    <main className="news-page candidate-page" id="contenu">
      <NewsMasthead section="CANDIDATS" />
      <div className="candidate-content">
        <header className="candidate-intro">
          <h1>
            Les candidats <em>en mouvement.</em>
          </h1>
        </header>

        <section
          className="candidate-roster"
          aria-label="Candidats classés selon les intentions de vote"
        >
          <div className="candidate-roster-heading">
            <span>Candidat</span>
            <span>Parti</span>
            <span>Intentions de vote</span>
          </div>
          {rankedCandidates.map((candidate) => {
            const current = currentPollValue(candidate.id);
            const first = getSmoothedPollValue(candidate.id, FIRST_POLL_DAY);
            const change = current !== null && first !== null ? current - first : null;
            return (
              <Link
                href={`/candidates/${candidate.id}`}
                className="candidate-roster-row"
                key={candidate.id}
              >
                <span className="candidate-roster-name">
                  <i style={{ backgroundColor: candidate.color }} />
                  <strong>{candidate.name}</strong>
                </span>
                <span className="candidate-party">
                  {candidate.party}
                  <small className="candidate-asof">
                    Terrain :{" "}
                    {candidateLatestDate(candidate.id)
                      ? formatShortDate(candidateLatestDate(candidate.id)!)
                      : "—"}
                  </small>
                </span>
                <span className="candidate-latest">
                  <strong>{current === null ? "—" : `${formatPct(current)} %`}</strong>
                  {change === null ? null : (
                    <span className={change >= 0 ? "candidate-up" : "candidate-down"}>
                      {change >= 0 ? "+" : ""}
                      {formatPct(change)} pts depuis le {formatShortDate(dayToIso(FIRST_POLL_DAY))}
                    </span>
                  )}
                  <i>
                    <b
                      style={{
                        width: `${Math.min(100, ((current ?? 0) / 40) * 100)}%`,
                        backgroundColor: candidate.color,
                      }}
                    />
                  </i>
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
