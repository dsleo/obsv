import { createHash } from "node:crypto";
export function eventInputHash(event: {
  sourceId?: string;
  title: string;
  summary: string;
  occurredAt: string;
  sources: { url: string }[];
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: event.title,
        description: event.summary,
        occurredAt: event.occurredAt.slice(0, 10),
        source: event.sourceId ?? event.sources[0]?.url ?? "",
      }),
    )
    .digest("hex");
}
