import type { CSSProperties } from "react";
import { ArrowRight, BarChart3, MapPinned, Newspaper, UsersRound } from "lucide-react";
import { radarEvents } from "../../data/radarData";

const preparationSteps = [
  {
    icon: UsersRound,
    title: "Une population synthétique",
    description: "Un échantillon enrichi de profils qui reflète la diversité de la population française.",
  },
  {
    icon: BarChart3,
    title: "Les intentions passées",
    description: "À partir des intentions de vote passées, le modèle apprend les liens entre profils et choix déclarés.",
  },
  {
    icon: MapPinned,
    title: "Un calage par commune",
    description: "Appliqué à chaque profil, le modèle est recalé pour retrouver les résultats électoraux de sa commune.",
  },
];

export function MethodExplainer() {
  const example = radarEvents.find((event) => event.id === "vat");
  const group = example?.impact.groups[0];

  return (
    <section className="method-section" id="method" aria-labelledby="method-title">
      <header className="method-heading">
        <div>
          <span className="method-kicker"><i /> LA MÉTHODE</span>
          <h2 id="method-title">Comment ça <em>marche&nbsp;?</em></h2>
        </div>
        <p>Des intentions de vote individuelles, puis l’actualité, pour estimer comment les équilibres pourraient évoluer.</p>
      </header>

      <div className="method-phase method-phase-preparation">
        <div className="method-phase-heading">
          <span className="method-phase-tag">LE SOCLE</span>
          <div><h3>Construire la population de référence</h3><p>Avant de mesurer l’effet d’un événement, on prépare une base cohérente avec la France réelle.</p></div>
        </div>
        <ol className="method-steps" aria-label="Préparation de la population de référence">
          {preparationSteps.map(({ icon: Icon, title, description }, index) => (
            <li className="method-step" key={title} style={{ "--step-delay": `${index * 1.35}s` } as CSSProperties}>
              <span className="method-step-icon"><Icon size={18} strokeWidth={1.6} /></span>
              <div><h4>{title}</h4><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </div>

      <div className="method-bridge" aria-hidden="true"><span /><i>La population est prête</i><span /></div>

      <div className="method-phase method-phase-events">
        <div className="method-phase-heading">
          <span className="method-phase-tag">L’ACTUALITÉ</span>
          <div><h3>Mesurer l’effet des événements</h3><p>Le système suggère les sous-populations concernées, puis les retrouve dans la population de référence.</p></div>
        </div>

        <div className="method-event-flow">
          <article className="method-example-story" style={{ "--step-delay": "4.05s" } as CSSProperties}>
            <span className="method-example-label"><Newspaper size={13} /> À LA UNE · EXEMPLE</span>
            <h4>{example?.title ?? "Un événement d’actualité"}</h4>
            <p>Un événement est transformé en signal à analyser, pas en effet automatique.</p>
          </article>

          <div className="method-flow-arrow" style={{ "--step-delay": "4.72s" } as CSSProperties} aria-hidden="true"><ArrowRight size={18} /></div>

          <article className="method-example-group" style={{ "--step-delay": "5.4s" } as CSSProperties}>
            <span className="method-example-label">PROFILS CONCERNÉS</span>
            <UsersRound size={21} strokeWidth={1.5} />
            <h4>{group?.name ?? "Une sous-population"}</h4>
            <p>Repérée dans la population de référence selon les caractéristiques liées à l’événement.</p>
            {group && <span className="method-example-flow">Exemple simulé&nbsp;: {group.flow} · {group.pct}</span>}
          </article>

          <div className="method-flow-arrow" style={{ "--step-delay": "6.07s" } as CSSProperties} aria-hidden="true"><ArrowRight size={18} /></div>

          <article className="method-example-vector" style={{ "--step-delay": "6.75s" } as CSSProperties}>
            <span className="method-example-label">VECTEUR D’INTENTIONS</span>
            <div className="method-vector-change">
              <div><small>AVANT</small><b>[ p₁ · p₂ · … · pₙ ]</b></div>
              <ArrowRight size={17} aria-hidden="true" />
              <div><small>APRÈS</small><b>[ p₁+Δ₁ · … · pₙ+Δₙ ]</b></div>
            </div>
            <p>Les variations individuelles sont agrégées pour estimer l’évolution des intentions par candidat.</p>
            {example && <strong className="method-example-result">{example.impact.voteEffect}</strong>}
          </article>
        </div>
      </div>

      <p className="method-caveat">Schéma de la méthode en développement. L’événement et les effets présentés ici sont des données de démonstration, pas des résultats réels.</p>
    </section>
  );
}
