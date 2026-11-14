import { radarEvents } from "../../data/radarData";
import { loadAnalysis } from "./loadAnalysis";

/** Events that get a page (/events/[id]): only those with a valid published analysis. Link to these, never to radarEvents. */
export const publishedEvents = radarEvents.filter((event) => loadAnalysis(event.id));
