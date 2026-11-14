import { SignalRadar } from "../components/radar/SignalRadar";
import { publishedEvents } from "../lib/radar/publishedEvents";

export default function Page() {
  return <SignalRadar linkableIds={publishedEvents.map((e) => e.id)} />;
}
