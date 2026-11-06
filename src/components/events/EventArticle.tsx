import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CircleDot, ExternalLink } from "lucide-react";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";
import { leadSegment } from "../../lib/radar/highlights";
import { EventSubpopulationAnalysis } from "./EventSubpopulationAnalysis";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";

function ArticleRow({ article }: { article: RadarEvent["articles"][number] }) {
  return <li><a href={article.url} target="_blank" rel="noopener noreferrer"><span>{article.publisher || "Presse"}</span><strong>{article.title}</strong><ExternalLink size={18} aria-hidden="true" /></a></li>;
}

export function EventArticle({ event, analysis }: { event: RadarEvent; analysis: AnalysisArtifact | null }) {
  const lead = leadSegment(analysis);
  const scenario = lead?.segment.counterfactual ?? analysis?.globalScenarios[0] ?? null;
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
            <p className="article-dropcap">{event.summary}</p>
            {lead ? <p>Ses effets ne sont pas uniformes. L’analyse met en avant <strong>{lead.segment.name}</strong> : {lead.segment.mechanism} {lead.segment.count.toLocaleString("fr-FR")} profils synthétiques de l’index correspondent à ce groupe ; c’est une hypothèse à tester, pas un résultat mesuré.</p> : null}
          </div>

          <div className="article-aside">
            <section className="article-impact-card">
              <span className="article-aside-kicker">RÉSULTAT DE L’ANALYSE · PROFILS SYNTHÉTIQUES</span>
              {lead ? <>
                <strong>{lead.contrast.sampledCount}</strong>
                <span className="article-impact-label">profils exposés dans l’échantillon · sur {lead.segment.count.toLocaleString("fr-FR")} correspondant au filtre</span>
                <div className="article-population"><span className="population-initial">{lead.segment.name.slice(0, 1)}</span><span><b>{lead.segment.name}</b><small>{lead.segment.distinctCommunes} communes</small></span></div>
                <dl>
                  <div><dt>RÉACTIONS LES PLUS NETTES</dt><dd className="orange-copy">{lead.signals.slice(0, 3).map((s) => `${s.label} : ${s.count}/${s.sampled} ${s.direction === "toward" ? "vers" : "s’éloignent"}`).join(" · ")}</dd></div>
                  {lead.segment.measurementNeeds.length ? <div><dt>À MESURER</dt><dd>{lead.segment.measurementNeeds.join(", ")}</dd></div> : null}
                </dl>
                <div className="article-group-list">
                  <span className="article-group-list-label">AUTRES GROUPES EXAMINÉS</span>
                  {analysis!.segments.filter((g) => g.id !== lead.segment.id).map((g) => <div className="article-group-row" key={g.id}><span><b>{g.name}</b><small>{g.status === "filterable_discovery_sample" ? "Groupe filtrable" : "Non évalué"}</small></span><strong>{g.count.toLocaleString("fr-FR")}</strong></div>)}
                </div>
              </> : <p className="event-analysis-caveat">Analyse non disponible pour cet événement.</p>}
            </section>

            {scenario ? <section className="article-scenario-card">
              <span className="article-aside-kicker"><CircleDot size={12} /> SCÉNARIO COMPARÉ</span>
              <h2>{scenario.intervention}</h2>
              <p>Plutôt que : {scenario.comparator}</p>
              <div className="scenario-candidate"><span>HYPOTHÈSE · AUCUNE VARIATION DE VOTE ESTIMÉE</span><ArrowUpRight size={16} /></div>
            </section> : null}
          </div>
        </div>

        {event.articles.length ? <section className="article-sources" aria-labelledby="article-sources-title">
          <div className="article-sources-heading"><h2 id="article-sources-title">Les articles de cette actualité</h2><span>{event.articles.length} article{event.articles.length > 1 ? "s" : ""} · {event.publisherCount} média{event.publisherCount > 1 ? "s" : ""}</span></div>
          <ul>{event.articles.slice(0, 8).map((article) => <ArticleRow key={article.url} article={article} />)}</ul>
          {event.articles.length > 8 ? <details><summary>Voir les {event.articles.length - 8} autres articles</summary><ul>{event.articles.slice(8).map((article) => <ArticleRow key={article.url} article={article} />)}</ul></details> : null}
        </section> : null}

        <EventSubpopulationAnalysis analysis={analysis} />

        <footer className="article-footer-note"><a href={event.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {event.sources} · LIRE L’ARTICLE</a><span>HYPOTHÈSES SUR PROFILS SYNTHÉTIQUES · PAS UN SONDAGE</span></footer>
      </article>

      <section className="article-related">
        <div className="news-desk-heading"><div><span className="news-kicker"><span /> POUR ALLER PLUS LOIN</span><h2>À lire aussi</h2></div></div>
        <div className="article-related-grid">{relatedEvents.map((related) => <Link href={`/events/${related.id}`} key={related.id}><span>{related.tag}</span><strong>{related.title}</strong><ArrowUpRight size={15} /></Link>)}</div>
      </section>
    </main>
  );
}
