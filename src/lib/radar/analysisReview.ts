import { createHash } from "node:crypto";

// Human review gate. The hash covers the artifact content minus its `review` block, so any edit
// or regeneration after approval invalidates the approval. Input must be the raw parsed JSON.
export function analysisContentHash(raw: Record<string, unknown>) {
  const { review: _review, ...content } = raw;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
