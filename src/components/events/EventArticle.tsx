import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { leadSegment } from "../../lib/radar/highlights";
import { diverseArticles, pct, reactionText, relatedArticles, shortTitle } from "../../lib/radar/labels";
import { EventSubpopulationAnalysis } from "./EventSubpopulationAnalysis";
import { ArticleList } from "./ArticleList";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";

export function EventArticle({ event, analysis }: { event: RadarEvent; analysis: AnalysisArtifact | null }) {
  const lead = leadSegment(analysis);
  const articles = diverseArticles(relatedArticles(event.articles, event.title));
  const relatedEvents = radarEvents.filter((candidate) => candidate.id !== event.id).slice(0, 2);

  return (
    <main className="news-page news-article-page">
      <NewsMasthead section="ÉVÉNEMENT" />

      <article className="news-article">
        <Link href="/events" className="news-back-link"><ArrowLeft size={14} /> Tous les événements</Link>

        <header className="article-header">
          <div className="news-story-meta"><span>{event.tag}</span><time>{event.date}</time></div>
          <h1>{event.title}</h1>
          
        </header>

        <figure className="article-hero">
          <div className="article-hero-image" style={{ backgroundImage: event.image }}>
            <span className="article-image-mark" style={{ backgroundColor: event.color }} />
            <span className="article-image-index">À LA UNE / {event.shortDate}</span>
          </div>
          <figcaption><span>{event.tag}</span><span>{event.sources}</span></figcaption>
        </figure>

        <div className="article-reading-grid">
          <div className="article-body">
            <p className="article-dropcap">{shortTitle(event.summary, 320)}</p>
            {lead ? <p>Ses effets ne sont pas uniformes : l’analyse met en avant <strong>{lead.segment.name}</strong>. C’est une hypothèse à tester, pas un résultat mesuré.</p> : null}
          </div>

          <div className="article-aside">
            <a className="article-impact-card" href="#analyse-des-publics">
              <span className="article-aside-kicker">GROUPE LE PLUS TOUCHÉ</span>
              {lead ? <>
                <strong className="article-impact-group" style={{ marginTop: "1.2rem" }}>{lead.segment.name}</strong>
                <p className="event-analysis-context">Part du groupe dont l’intention change, par rapport à un monde sans cet événement.</p>
                <ul className="article-impact-reactions">{lead.signals.slice(0, 3).map((x) => <li key={x.bloc + x.direction}><b>{pct(x.count, x.sampled)}</b><span>{reactionText(x.bloc, x.direction)}</span></li>)}</ul>
              </> : <p className="event-analysis-caveat">Analyse non disponible pour cet événement.</p>}
            </a>
          </div>
        </div>

        <EventSubpopulationAnalysis analysis={analysis} />

        {articles.length ? <section className="article-sources" aria-labelledby="article-sources-title">
          <div className="article-sources-heading"><h2 id="article-sources-title">Les articles de cette actualité</h2><span>{articles.length} article{articles.length > 1 ? "s" : ""} · {event.publisherCount} média{event.publisherCount > 1 ? "s" : ""}</span></div>
          <ArticleList articles={articles} />
        </section> : null}
      </article>

      <section className="article-related">
        <div className="news-desk-heading"><div><span className="news-kicker"><span /> POUR ALLER PLUS LOIN</span><h2>À lire aussi</h2></div></div>
        <div className="article-related-grid">{relatedEvents.map((related) => <Link href={`/events/${related.id}`} key={related.id}><span>{related.tag}</span><strong>{related.title}</strong><ArrowUpRight size={15} /></Link>)}</div>
      </section>
    </main>
  );
}
