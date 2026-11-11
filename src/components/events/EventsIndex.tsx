import Link from "next/link";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import { EventGrid, StoryImage } from "./EventGrid";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";

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
          </div>
        </section>

        <div className="news-desk-heading">
          <div><span className="news-kicker"><span /> DANS LES ARCHIVES</span><h2>À la une des événements</h2></div>
        </div>

        <EventGrid events={secondary.map(({ id, title, summary, tag, shortDate, date, image, color }) => ({ id, title, summary, tag, shortDate, date, image, color }))} />

      </div>
    </main>
  );
}
