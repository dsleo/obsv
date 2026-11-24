import { radarEvents } from "../../data/radarData";
import { loadAnalysis } from "./loadAnalysis";
import { qualifyingSegments } from "./highlights";

/** Events that get a page (/events/[id]): only those with a qualifying subgroup in a valid published analysis. Link to these, never to radarEvents. */
export const publishedEvents = radarEvents.filter((event) => qualifyingSegments(loadAnalysis(event.id)).length > 0);
