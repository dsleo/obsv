import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { alternativeFlags } from "../../../pipeline/radar/alternative";
import { diverseArticles } from "../../lib/radar/labels";
import { EventSubpopulationAnalysis } from "./EventSubpopulationAnalysis";
import { ArticleList } from "./ArticleList";
import { NewsMasthead } from "./NewsMasthead";
import { sitePath } from "../../lib/paths";
import "./event-pages.css";
export function EventArticle({
  event,
  analysis,
}: {
  event: RadarEvent;
  analysis: AnalysisArtifact | null;
}) {
  const articles = diverseArticles(event.articles);
  const publishers = new Set(
    articles.map((a) => a.publisher.toLocaleLowerCase("fr")).filter(Boolean),
  ).size;
  const related = radarEvents
    .filter((e) => e.id !== event.id)
    .map((e) => ({
      event: e,
      score:
        (event.storyId && event.storyId === e.storyId ? 10 : 0) +
        e.candidateIds.filter((id) => event.candidateIds.includes(id)).length * 3 +
        (e.filter === event.filter ? 1 : 0),
    }))
    .filter((e) => e.score >= 3)
    .sort((a, b) => b.score - a.score || b.event.pollDay - a.event.pollDay)
    .slice(0, 2)
    .map((x) => x.event);
  const recommended = related.length
    ? related
    : radarEvents.filter((e) => e.id !== event.id).slice(0, 2);
  return (
    <main className="news-page news-article-page" id="contenu">
      <NewsMasthead section="ÉVÉNEMENT" />
      <article className="news-article">
        <Link href="/events" className="news-back-link">
          <ArrowLeft size={14} />
          Tous les événements
        </Link>
        <header className="article-header">
          <div className="news-story-meta">
            <span>{event.tag}</span>
            <time dateTime={event.isoDate}>{event.date}</time>
          </div>
          <h1>{event.title}</h1>
        </header>
        <div className="article-facts">
          <p className="article-dropcap">
            {event.summaryKind === "coverage"
              ? "Les faits rapportés sont à consulter dans les articles sources ci-dessous."
              : event.summary}
          </p>
          <p className="article-primary-source">
            Source originale :{" "}
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              {event.sources.replace(/^SOURCES : /, "")}
              <span className="sr-only"> (nouvel onglet)</span>
            </a>
          </p>
        </div>
        {event.imageUrl && (
          <figure className="article-hero">
            <img src={event.imageUrl} alt="" width="1200" height="675" fetchPriority="high" />
            <figcaption>{event.imageCredit ?? "Illustration de l’actualité"}</figcaption>
          </figure>
        )}
        {articles.length > 0 && (
          <section className="article-sources" aria-labelledby="article-sources-title">
            <div className="article-sources-heading">
              <h2 id="article-sources-title">Lire les sources</h2>
              <span>
                {articles.length} article{articles.length > 1 ? "s" : ""}
                {publishers ? ` · ${publishers} média${publishers > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <ArticleList articles={articles} />
          </section>
        )}
        <EventSubpopulationAnalysis
          analysis={analysis}
          showAlternative={Boolean(
            analysis?.alternative &&
              !alternativeFlags(
                { title: event.title, description: event.summary },
                analysis.alternative,
              ).length,
          )}
        />
      </article>
      {recommended.length > 0 && (
        <section className="article-related">
          <div className="news-desk-heading">
            <h2>{related.length ? "Sur le même sujet" : "Dernières actualités"}</h2>
          </div>
          <div className="article-related-grid">
            {recommended.map((e) => (
              <Link href={sitePath(`/events/${e.id}`)} key={e.id}>
                <span>{e.tag}</span>
                <strong>{e.title}</strong>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
