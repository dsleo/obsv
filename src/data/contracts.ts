export type ArticleRecord = {
  id?: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt?: string;
  description?: string;
  image?: string;
};
export type PollRecord = {
  id: string;
  publishedAt: string;
  fieldworkStart?: string;
  fieldworkEnd: string;
  pollster: string;
  sampleSize: number;
  round?: "first" | "runoff";
  candidateShares: Record<string, number>;
  source: { title: string; url: string };
};
export type EventRecord = {
  id: string;
  sourceId?: string;
  occurredAt: string;
  title: string;
  summary: string;
  summaryKind?: "source" | "coverage";
  category?: string;
  importance?: "major" | "notable";
  candidateIds?: string[];
  publisherCount?: number;
  sourceClusterPublisherCount?: number;
  storyId?: string;
  image?: string;
  imageCredit?: string;
  imageRights?: "licensed" | "permission" | "unverified";
  articles?: ArticleRecord[];
  editorialStatus?: "draft" | "reviewed" | "published" | "retracted";
  publication?: { mode: "automatic" | "reviewed"; policyVersion: string };
  quality?: { version: string; selection: string; sourceMetadata: string; removedArticles: number };
  sources: { title: string; url: string }[];
};
export type Snapshot = {
  schemaVersion: number;
  generatedAt: string;
  dataHash: string;
  polls: PollRecord[];
  events: EventRecord[];
};
