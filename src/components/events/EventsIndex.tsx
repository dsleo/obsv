import Link from "next/link";
import { radarEvents } from "../../data/radarData";
import { EventGrid, StoryImage } from "./EventGrid";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";
export function EventsIndex() {
  const lead = radarEvents[0];
  return (
    <main className="news-page" id="contenu">
      <NewsMasthead section="ÉVÉNEMENTS" />
      <div className="news-content">
        <section className="news-intro archive-intro">
          <div>
            <span className="news-kicker">LE FIL DE L’ACTUALITÉ</span>
            <h1>
              Les faits, <em>dans leur contexte.</em>
            </h1>
          </div>
        </section>
        {lead && (
          <section
            className={`news-lead-story ${lead.imageUrl ? "" : "is-text-only"}`}
            aria-labelledby="lead-story-heading"
          >
            {lead.imageUrl && (
              <Link
                href={`/events/${lead.id}`}
                className="news-lead-image-link"
                aria-label={lead.title}
              >
                <StoryImage event={lead} featured />
              </Link>
            )}
            <div className="news-lead-copy">
              <div className="news-story-meta">
                <span>{lead.tag}</span>
                <time dateTime={lead.isoDate}>{lead.date}</time>
              </div>
              <Link href={`/events/${lead.id}`} className="news-story-link">
                <h2 id="lead-story-heading">{lead.title}</h2>
              </Link>
              {lead.summaryKind !== "coverage" && <p>{lead.summary}</p>}
            </div>
          </section>
        )}
        <div className="news-desk-heading">
          <h2>Explorer les actualités</h2>
        </div>
        <EventGrid
          events={radarEvents.map(
            ({
              articles,
              sources,
              sourceUrl,
              publisherCount,
              pollDay,
              importance,
              filter,
              publicationMode,
              ...e
            }) => e,
          )}
        />
        {!lead && (
          <p className="empty-state">
            Les actualités seront affichées dès qu’une sélection aura été publiée.{" "}
            <Link href="/">Consulter les sondages</Link>.
          </p>
        )}
      </div>
    </main>
  );
}
