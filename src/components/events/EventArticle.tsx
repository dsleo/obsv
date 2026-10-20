import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CircleDot, ExternalLink } from "lucide-react";
import type { RadarEvent } from "../../data/radarData";
import { radarEvents } from "../../data/radarData";
import { NewsMasthead } from "./NewsMasthead";
import "./event-pages.css";

export function EventArticle({ event }: { event: RadarEvent }) {
  const relatedEvents = radarEvents.filter((candidate) => candidate.id !== event.id).slice(0, 2);

  return (
    <main className="news-page news-article-page">
      <NewsMasthead section="ÉVÉNEMENT" />

      <article className="news-article">
        <Link href="/events" className="news-back-link"><ArrowLeft size={14} /> Tous les événements</Link>

        <header className="article-header">
          <div className="news-story-meta"><span>{event.tag}</span><time>{event.date}</time></div>
          <h1>{event.title}</h1>
          <p className="article-dek">{event.summary}</p>
        </header>

        <figure className="article-hero">
          <div className="article-hero-image" style={{ backgroundImage: `url(${event.image})` }}>
            <span className="article-image-mark" style={{ backgroundColor: event.color }} />
            <span className="article-image-index">À LA UNE / {event.shortDate}</span>
          </div>
          <figcaption><span>IMAGE D’ILLUSTRATION</span><span>{event.sources}</span></figcaption>
        </figure>

        <div className="article-reading-grid">
          <div className="article-body">
            <p className="article-dropcap">Un événement prend son sens politique à travers ses conséquences concrètes.</p>
            <p>{event.summary} Il s’inscrit désormais dans les préoccupations du quotidien : qu’est-ce qui change, qui en supporte le coût, et quel candidat semble en mesure d’agir ?</p>
            <p>Ses effets ne sont pas uniformes. La réaction la plus marquée se dessine chez <strong>{event.impact.group}</strong>, où {event.impact.concern.toLowerCase()} Ce groupe représente {event.impact.groupShare} : c’est le plus net à suivre pour comprendre l’évolution du signal.</p>
            <div className="article-pullquote">« L’actualité devient électorale quand chacun y reconnaît une part de son quotidien. »</div>
            <p>Ce scénario ne prédit pas à lui seul le résultat. Il examine comment l’attention peut devenir une préférence, et comment la réponse d’un candidat peut infléchir cette évolution.</p>
          </div>

          <aside className="article-aside">
            <section className="article-impact-card">
              <span className="article-aside-kicker">EXEMPLE FICTIF · EFFET SUR LA POPULATION</span>
              <strong>{event.impact.value}</strong>
              <span className="article-impact-label">{event.impact.label} · valeur fictive du prototype</span>
              <div className="article-population"><span className="population-initial">{event.impact.group.slice(0, 1)}</span><span><b>{event.impact.group}</b><small>{event.impact.groupShare}</small></span></div>
              <dl>
                <div><dt>PRÉOCCUPATION PRINCIPALE</dt><dd>{event.impact.concern}</dd></div>
                <div><dt>EFFET SUR LES INTENTIONS DE VOTE</dt><dd className="orange-copy">{event.impact.voteEffect}</dd></div>
              </dl>
              <div className="article-group-list">
                <span className="article-group-list-label">AUTRES GROUPES CONCERNÉS</span>
                {event.impact.groups.slice(1).map((group) => <div className="article-group-row" key={group.name}><span><b>{group.name}</b><small>{group.flow}</small></span><strong>{group.pct}</strong></div>)}
              </div>
            </section>

            <section className="article-scenario-card">
              <span className="article-aside-kicker"><CircleDot size={12} /> {event.scenario.label}</span>
              <h2>{event.scenario.title}</h2>
              <p>{event.scenario.description}</p>
              <div className="scenario-candidate"><span>SCÉNARIO FICTIF · ÉVOLUTION ENVISAGÉE</span><b>{event.scenario.candidate}</b><strong>{event.scenario.candidateMove}</strong><ArrowUpRight size={16} /></div>
            </section>
          </aside>
        </div>

        <section className="event-subpopulation">
          <div className="event-subpopulation-heading"><div><span className="news-kicker"><span /> ANALYSE DES PUBLICS</span><h2>Qui est concerné ?</h2></div></div>
          <p className="event-analysis-caveat">Les résultats affichés ici sont des données de démonstration. Les analyses validées seront publiées avec leur méthode, leurs sources et leur date de calcul ; aucune analyse n’est lancée depuis cette page.</p>
        </section>

        <footer className="article-footer-note"><span><ExternalLink size={13} /> {event.sources}</span><span>SCÉNARIO ILLUSTRATIF · PAS UN SONDAGE</span></footer>
      </article>

      <section className="article-related">
        <div className="news-desk-heading"><div><span className="news-kicker"><span /> POUR ALLER PLUS LOIN</span><h2>À lire aussi</h2></div></div>
        <div className="article-related-grid">{relatedEvents.map((related) => <Link href={`/events/${related.id}`} key={related.id}><span>{related.tag}</span><strong>{related.title}</strong><ArrowUpRight size={15} /></Link>)}</div>
      </section>
    </main>
  );
}
