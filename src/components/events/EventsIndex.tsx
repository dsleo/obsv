import Link from "next/link";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";

function StoryImage({ event, featured = false }: { event: RadarEvent; featured?: boolean }) {
  return (
    <span className={`news-story-image ${featured ? "is-featured" : ""}`} style={{ backgroundImage: `url(${event.image})` }}>
      <span className="news-story-image-mark" style={{ backgroundColor: event.color }} />
      <span className="news-story-image-index">{event.date.slice(0, 2)}</span>
    </span>
  );
}

export function EventsIndex() {
  const [lead, ...secondary] = [...radarEvents].sort((a, b) => b.pollDay - a.pollDay);

  return (
    <main className="news-page">
      <NewsMasthead section="ÉVÉNEMENTS" />

      <div className="news-content">
        <section className="news-intro">
          <div>
            <span className="news-kicker"><span /> LE FIL DE L’ACTUALITÉ</span>
            <h1>Les récits derrière <em>les mouvements.</em></h1>
          </div>
          <p>Chaque événement traverse la société à sa manière et peut infléchir les intentions de vote. Ici, nous suivons ces liens et les groupes les plus concernés.</p>
        </section>

        <section className="news-lead-story" aria-labelledby="lead-story-heading">
          <Link href={`/events/${lead.id}`} className="news-lead-image-link">
            <StoryImage event={lead} featured />
          </Link>
          <div className="news-lead-copy">
            <div className="news-story-meta"><span>{lead.tag}</span><time>{lead.date}</time></div>
            <Link href={`/events/${lead.id}`} className="news-story-link">
              <h2 id="lead-story-heading">{lead.title}</h2>
            </Link>
            <p>{lead.summary}</p>
            <div className="news-lead-footer"><span><b>{lead.impact.value}</b> effet de démonstration</span><span>Groupe illustratif : {lead.impact.group}</span></div>
          </div>
        </section>

        <div className="news-desk-heading">
          <div><span className="news-kicker"><span /> DANS LES ARCHIVES</span><h2>À la une des événements</h2></div>
        </div>

        <section className="news-event-grid" aria-label="Événements à la une">
          {secondary.map((event, index) => (
            <Link href={`/events/${event.id}`} className={`news-story-card ${index === 0 ? "is-offset" : ""}`} key={event.id}>
              <StoryImage event={event} />
              <div className="news-story-card-copy">
                <div className="news-story-meta"><span>{event.tag}</span><time>{event.shortDate}</time></div>
                <h3>{event.title}</h3>
                <p>{event.summary}</p>
              </div>
            </Link>
          ))}
        </section>

      </div>
    </main>
  );
}
