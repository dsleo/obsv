// Source integrity rules shared by ingestion and snapshot publication. Never turn a Google
// cluster's flattened description into a factual summary of its representative story.
export const EVENT_QUALITY_VERSION = "event-quality-v2";
export const cleanText = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
export const fold = (value) =>
  cleanText(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const httpUrl = (value) => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
};
const generic = new Set(
  "apres avant avec dans pour sans sous entre vers cette cet une des les est sont plus moins france francais francaise presidentielle election elections affaire proces appel verdict tribunal justice condamne mise examen aura lieu renvoye renvoyee septembre octobre novembre decembre janvier fevrier mars avril juin juillet aout lundi mardi mercredi jeudi vendredi samedi dimanche education nouvelle journee greve mobilisation manifestations manifestation gouvernement assemblee conseil photo direct replay video entretien declaration candidat candidature soutien programme annonce annoncee".split(
    " ",
  ),
);
const words = (text) =>
  new Set(
    fold(text)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((w) => w.length > 3 && !generic.has(w) && !/^\d+$/.test(w)),
  );

export function articleMatches(title, subject) {
  const a = words(title),
    b = words(subject);
  const named = [...subject.matchAll(/\b[\p{Lu}][\p{L}’'-]{3,}/gu)]
    .map((x) => fold(x[0]))
    .filter((w) => !generic.has(w));
  // A shared first name (Marine) must not join different people. Prefer full surname anchors.
  const normalizedSubject = ` ${fold(subject).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const normalizedTitle = ` ${fold(title).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const aliases = [
    ["marine le pen", "le pen"],
    ["marine tondelier", "tondelier"],
    ["jean luc melenchon", "melenchon"],
    ["edouard philippe", "philippe"],
    ["raphael glucksmann", "glucksmann"],
    ["gabriel attal", "attal"],
    ["bruno retailleau", "retailleau"],
    ["david lisnard", "lisnard"],
  ];
  const people = aliases.filter(([full]) =>
    normalizedSubject.includes(` ${full} `),
  );
  if (people.length)
    return people.some(([, surname]) =>
      normalizedTitle.includes(` ${surname} `),
    );
  if (named.length)
    return named.filter((w) => a.has(w)).length >= Math.min(2, named.length);
  const shared = [...a].filter((w) => b.has(w)).length;
  return (
    shared >= Math.min(2, b.size) &&
    shared >= Math.ceil(b.size / 2) &&
    shared > 0
  );
}

export function isProductReview(title) {
  const t = fold(title);
  return (
    (/\b(essai|teste|test|diaporama)\b/.test(t) &&
      /\b(volkswagen|ipad|oled|hybrid|01lab|tgv|km)\b/.test(t)) ||
    (/\bnotre verdict\b/.test(t) && /\b(km|01lab|hybrid|voiture)\b/.test(t))
  );
}

// Compatibility for old APIs. Pick the first publisher boundary, never the last one in a
// concatenation. Unknown metadata gets a neutral label; it is not guessed from another row.
export function legacyArticle(e, id, i) {
  const raw = cleanText(e.source_descriptions?.[i]);
  const boundaries = (e.publishers ?? [])
    .map((p) => ({ publisher: p, at: raw.indexOf(` ${p}`) }))
    .filter((x) => x.at > 15)
    .sort((a, b) => a.at - b.at || b.publisher.length - a.publisher.length);
  const first = boundaries[0];
  const title = first
    ? raw
        .slice(0, first.at)
        .replace(/\s*[-–|]\s*$/, "")
        .trim()
    : id === e.representative_source
      ? e.title
      : "";
  return {
    id,
    title,
    publisher: first?.publisher ?? "",
    url: httpUrl(e.source_urls?.[i]),
    description: null,
    image_url: null,
    inferred: true,
  };
}

export function sourceArticles(e) {
  const rows = Array.isArray(e.articles)
    ? e.articles
    : (e.sources ?? []).map((id, i) => legacyArticle(e, id, i));
  const seen = new Set();
  return rows.flatMap((a) => {
    const url = httpUrl(a.url),
      title = cleanText(a.title);
    if (
      !url ||
      !title ||
      seen.has(url) ||
      isProductReview(title) ||
      !articleMatches(title, e.title)
    )
      return [];
    seen.add(url);
    return [
      {
        id: a.id,
        title,
        publisher: cleanText(a.publisher),
        url,
        ...(a.published_at ? { publishedAt: a.published_at } : {}),
        ...(a.description && !a.inferred
          ? { description: cleanText(a.description) }
          : {}),
        ...(httpUrl(a.image_url) ? { image: httpUrl(a.image_url) } : {}),
      },
    ];
  });
}

export function eventInputDigestInput(event) {
  return {
    title: event.title,
    description: event.summary,
    occurredAt: event.occurredAt.slice(0, 10),
    sourceUrl: event.sources[0]?.url ?? "",
  };
}
