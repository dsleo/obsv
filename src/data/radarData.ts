// Full article collections are build/server data. Browser charts import chartData instead.
import rawSnapshot from "../../data/generated/snapshot.json";
import type { Snapshot } from "./contracts";
import { presentEvent } from "./chartData";
export * from "./chartData";
export const publicSnapshot = rawSnapshot as unknown as Snapshot;
export const radarEvents = publicSnapshot.events
  .map(presentEvent)
  .sort((a, b) => b.pollDay - a.pollDay);
