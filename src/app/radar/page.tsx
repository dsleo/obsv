import { SignalRadar } from "../../components/radar/SignalRadar";
import { heatedSoldes, topSolde } from "../../lib/radar/highlights";
import { loadAnalysis } from "../../lib/radar/loadAnalysis";
import { publishedEvents } from "../../lib/radar/publishedEvents";
import { pageMetadata } from "../../lib/metadata";

export const metadata = pageMetadata("Le radar", "Sondages de la présidentielle, événements marquants et leur effet simulé.");

export default function RadarPage() {
  const soldes = heatedSoldes(publishedEvents.map((e) => topSolde(loadAnalysis(e.id))));
  return <SignalRadar linkableIds={publishedEvents.map((e) => e.id)} soldes={soldes} />;
}
