import type { AnalysisArtifact } from "../../lib/radar/analysisArtifact";

type Segment = AnalysisArtifact["segments"][number];

const statusLabels: Record<Segment["status"], string> = {
  filterable_discovery_sample: "Groupe filtrable",
  insufficient_sample: "Échantillon limité",
  incomplete_membership: "Définition incomplète",
  invalid_filter: "Filtre invalide",
};
const blocLabels: Record<string, string> = {
  radical_left: "Gauche radicale", left: "Gauche", center: "Centre",
  right: "Droite", far_right: "Extrême droite", abstention: "Abstention",
};

function Contrast({ contrast }: { contrast: AnalysisArtifact["contrasts"][string] }) {
  return <div className="event-analysis-response">
    <strong>Réactions directionnelles · {contrast.sampledCount} profils synthétiques exposés</strong>
    <p>Dans cet échantillon, par rapport à : {contrast.comparator}</p>
    <div className="event-analysis-blocs">{Object.entries(contrast.summary).map(([bloc, values]) => <div key={bloc}><b>{blocLabels[bloc] ?? bloc}</b><span><i>{values.toward} vers</i><i>{values.away} s’éloignent</i><i>{values.noClearChange} sans changement net</i></span></div>)}</div>
    <p className="event-analysis-note">{contrast.note}</p>
  </div>;
}

export function EventSubpopulationAnalysis({ analysis }: { analysis: AnalysisArtifact | null }) {
  return <section className="event-subpopulation">
    <div className="event-subpopulation-heading"><div><span className="news-kicker"><span /> ANALYSE DES PUBLICS</span><h2>Qui est concerné ?</h2></div></div>
    {!analysis ? <p className="event-analysis-caveat">Analyse non disponible pour cet événement. Les analyses sont calculées hors ligne, relues, puis publiées avec leur méthode et leur date de calcul ; aucune n’est lancée depuis cette page.</p> : <div className="event-analysis-results">
      {analysis.demo ? <p className="event-analysis-warning">Analyse calculée sur un événement de démonstration, sans source vérifiable.</p> : null}
      <div className="event-analysis-proof"><strong>Hypothèses à examiner</strong><span>{analysis.index.rowCount.toLocaleString("fr-FR")} personas dans l’index · aucune estimation de part de vote</span></div>
      {analysis.segments.map((segment) => <article className="event-analysis-segment" key={segment.id}>
        <div className="event-analysis-segment-head"><h3>{segment.name}</h3><span>{statusLabels[segment.status]}</span></div>
        <p>{segment.mechanism}</p><p>{segment.reason}</p>
        <div className="event-analysis-tags">{segment.all.map((tag) => <code key={tag}>{tag}</code>)}{segment.any.map((tag) => <code key={tag}>au choix : {tag}</code>)}{segment.none.map((tag) => <code key={tag}>sauf : {tag}</code>)}</div>
        <p className="event-analysis-support">{segment.count.toLocaleString("fr-FR")} profils correspondent au filtre · {segment.distinctCommunes} communes</p>
        {segment.membershipGaps.length ? <p className="event-analysis-warning">Données manquantes pour définir le groupe : {segment.membershipGaps.join(", ")}</p> : null}
        {segment.measurementNeeds.length ? <p className="event-analysis-warning">À mesurer : {segment.measurementNeeds.join(", ")}</p> : null}
        <div className="event-analysis-counterfactual"><small>SCÉNARIO COMPARÉ</small><p>{segment.counterfactual.intervention}</p><span>Plutôt que : {segment.counterfactual.comparator}</span></div>
        {analysis.contrasts[segment.id] ? <Contrast contrast={analysis.contrasts[segment.id]} /> : null}
      </article>)}
      {analysis.globalScenarios.map((scenario, index) => analysis.contrasts[`global_${index + 1}`] ? <article className="event-analysis-segment" key={index}>
        <div className="event-analysis-segment-head"><h3>Scénario d’ensemble {index + 1}</h3></div>
        <div className="event-analysis-counterfactual"><small>SCÉNARIO COMPARÉ</small><p>{scenario.intervention}</p><span>Plutôt que : {scenario.comparator}</span></div>
        <Contrast contrast={analysis.contrasts[`global_${index + 1}`]} />
      </article> : null)}
      <p className="event-analysis-note">{analysis.note} Méthode {analysis.methodVersion} · modèle {analysis.model} · calculé le {new Date(analysis.computedAt).toLocaleDateString("fr-FR")}.</p>
    </div>}
  </section>;
}
