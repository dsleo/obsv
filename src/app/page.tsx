import { SignalRadar } from "../components/radar/SignalRadar";
import { radarEvents } from "../data/radarData";
import { leadSegment } from "../lib/radar/highlights";
import { loadAnalysis } from "../lib/radar/loadAnalysis";

export default function Page() {
  const publics = Object.fromEntries(radarEvents.flatMap((event) => {
    const lead = leadSegment(loadAnalysis(event.id));
    return lead ? [[event.id, lead.segment.name]] : [];
  }));
  return <SignalRadar publics={publics} />;
}
