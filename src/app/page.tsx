import { SignalRadar } from "../components/radar/SignalRadar";
import { heatedSoldes, topSolde } from "../lib/radar/highlights";
import { loadAnalysis } from "../lib/radar/loadAnalysis";
import { publishedEvents } from "../lib/radar/publishedEvents";

export default function Page() {
  const soldes = heatedSoldes(publishedEvents.map((e) => topSolde(loadAnalysis(e.id))));
  return <SignalRadar linkableIds={publishedEvents.map((e) => e.id)} soldes={soldes} />;
}
