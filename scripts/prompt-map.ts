// Generates docs/prompt-map.html: every LLM call of the analysis pipeline, in order, with its live system prompt,
// what goes in, what must come out (as plain text, no JSON) and a real example taken from a published analysis.
// Run: npm run docs:prompts   (the prompts are imported from the code, so they never drift; the field lists are written by hand below).
import { readFileSync, writeFileSync } from "node:fs";
import { ALTERNATIVE_SYSTEM } from "../pipeline/radar/alternative";
import { EVENT_MAP_SYSTEM, EVENT_MAP_REPAIR_SYSTEM } from "../pipeline/radar/pipeline";
import { SYSTEM_ROLEPLAY, SYSTEM_DEMOGRAPHIC } from "../pipeline/radar/probabilisticResponse";
import { RELATIVE_SYSTEM } from "../pipeline/radar/relativeResponse";
import { MAX_REPAIR_ROUNDS, MAX_SEGMENT_SHARE, MIN_COMMUNES, MIN_SEGMENT_SIZE, MIN_USABLE_SEGMENTS, TARGET_SEGMENTS } from "../pipeline/radar/segmentRepair";
import { PINNED_ANALYSIS_MODEL } from "../src/lib/radar/analysisPolicy";

const EXAMPLE_ID = "google-22546"; // a published analysis used for the real examples
const art = JSON.parse(readFileSync(`data/generated/analyses/${EXAMPLE_ID}.json`, "utf8"));
const seg = art.segments[0];
const quotes: string[] = art.contrasts[seg.id].mechanisms ?? [];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Field = [name: string, text: string];
type Stage = {
  id: string; kind: "llm" | "code"; title: string; where: string; calls: string; role: string; legacy?: boolean;
  system?: string; variants?: { label: string; text: string }[];
  input?: Field[]; output?: Field[]; example?: { label: string; fields: Field[] };
};

const stages: Stage[] = [
  { id: "event", kind: "code", title: "Événement", where: "data/generated/snapshot.json", calls: "aucun appel", role: "Le titre et le résumé factuel de l’événement public. La date et l’URL ne sont jamais envoyées au modèle : elles l’inviteraient à se souvenir de la vraie issue." },
  {
    id: "alt", kind: "llm", title: "A · Scénario alternatif", where: "pipeline/radar/alternative.ts", calls: "1 à 3 appels par événement",
    role: "Invente une variante proche de l’événement. Un contrôle sans LLM (nom nouveau, ton seul, copie, hors sujet…) renvoie ses reproches au modèle ; la tentative la moins signalée est gardée.",
    system: ALTERNATIVE_SYSTEM,
    input: [["Événement", "titre et description"], ["Retour sur la tentative précédente", "seulement aux 2e et 3e essais : la liste des défauts détectés"]],
    output: [["Description", "le scénario alternatif"], ["Ce qui change", "une phrase : la différence avec l’événement réel et les publics touchés"]],
    example: { label: `Sortie réelle (${EXAMPLE_ID})`, fields: [["Description", art.alternative.description], ["Ce qui change", art.alternative.whatChanges]] },
  },
  {
    id: "map", kind: "llm", title: "B · Carte des publics concernés", where: "pipeline/radar/pipeline.ts", calls: "1 appel par événement",
    role: "Propose 3 à 4 groupes de profils (des filtres sur des tags). Il ne chiffre rien : il dit qui est concerné et pourquoi.",
    system: EVENT_MAP_SYSTEM,
    input: [["Événement", "titre et description"], ["Familles de tags à valeur unique", "âge, sexe, diplôme, profession, foyer…"], ["Clusters", "14 publics prédéfinis, avec leurs effectifs"], ["Tags disponibles", "chaque tag avec son effectif dans l’index"], ["Tailles", `taille de l’index, taille maximale d’un segment, minimum ${MIN_SEGMENT_SIZE}`]],
    output: [["Nom", "nom du groupe"], ["Mécanisme", "1 à 2 phrases qui citent l’événement et expliquent pourquoi ce public est concerné"], ["Raison", "pourquoi ce public"], ["Filtre", "tags à réunir (tous), au moins un de (any), à exclure (none)"], ["Lacunes d’appartenance", "attribut nécessaire que les tags ne peuvent pas représenter"], ["À mesurer", "variables à mesurer pour valider l’hypothèse"]],
    example: { label: `Sortie réelle (${EXAMPLE_ID}), premier des 4 groupes`, fields: [["Nom", seg.name], ["Mécanisme", seg.mechanism], ["Raison", seg.reason], ["Filtre", `tous : ${seg.all.join(", ") || "—"} · au moins un de : ${seg.any.join(", ") || "—"} · exclure : ${seg.none.join(", ") || "—"}`], ["À mesurer", seg.measurementNeeds.join(" · ")]] },
  },
  { id: "check", kind: "code", title: "Contrôle des segments", where: "pipeline/radar/pipeline.ts · segmentRepair.ts", calls: "aucun appel", role: `Valide chaque filtre (tags connus, une valeur par famille) et compte les profils : au moins ${MIN_SEGMENT_SIZE} personnes, ${MIN_COMMUNES} communes, au plus ${MAX_SEGMENT_SHARE * 100} % de l’index, pas de doublon ni de groupe générique. Objectif : ${TARGET_SEGMENTS} segments retenus.` },
  {
    id: "repair", kind: "llm", title: "C · Réparation des segments", where: "pipeline/radar/pipeline.ts", calls: `0 à ${MAX_REPAIR_ROUNDS} appels, tant qu’il manque des segments`,
    role: "Même prompt que B, plus une mission de réparation : on lui renvoie les segments refusés avec la raison, et les segments déjà acceptés à ne pas répéter.",
    system: EVENT_MAP_REPAIR_SYSTEM,
    input: [["Tout ce que reçoit B", "événement, tags, clusters, tailles"], ["Nombre à remplacer", "combien de segments manquent"], ["Acceptés", "nom, filtre et effectif de chaque segment déjà retenu"], ["Refusés", "nom, filtre, effectif et raison précise du refus (trop petit, trop large, doublon…)"]],
    output: [["Même structure que B", "des segments de remplacement, plus étroits"]],
  },
  { id: "fallback", kind: "code", title: "Repli et échantillonnage", where: "pipeline/radar/pipeline.ts · relativeResponse.ts", calls: "aucun appel", role: `S’il reste moins de ${MIN_USABLE_SEGMENTS} segments valides, les segments refusés sont desserrés (retrait de tags). Pour chaque segment retenu, un échantillon divers de profils est tiré de façon déterministe ; un scénario global (tout l’index) est ajouté par gabarit.` },
  {
    id: "personas", kind: "llm", title: "D · Réponses des profils (jeu de rôle)", where: "pipeline/radar/probabilisticResponse.ts", calls: "lots de 4 profils · 2 passes indépendantes · 24 profils par segment (48 pour le scénario global)",
    role: "Le modèle incarne chaque personne : une réaction à la première personne, puis trois intentions de vote (sans l’événement, avec l’événement, avec le scénario alternatif). Les candidats sont présentés dans un ordre aléatoire fixé par graine, pour éviter un biais de position.",
    system: SYSTEM_ROLEPLAY(true, true),
    variants: [{ label: "Variante « demographic » (ANALYZE_PERSONA=demographic, non utilisée par défaut)", text: SYSTEM_DEMOGRAPHIC(true, true) }],
    input: [["Événement", "titre et description"], ["Scénario alternatif", "description et ce qui change (étape A)"], ["Candidats", "identifiant → nom, plus « ne vote pas »"], ["Pour chaque personne", "identifiant · âge, sexe, diplôme, profession, foyer, situation, commune, département, densité · biographie · parcours professionnel · résultats électoraux de la commune (2022, 2024, 2026) · intention de vote de base (modèle d’enquête 2022 recalé sur les sondages des 45 jours précédents)"]],
    output: [["Réaction", "1 à 2 phrases à la première personne : ce que la personne pense de la nouvelle, ou son indifférence"], ["Sans l’événement", "part de vote par candidat + abstention (somme = 1)"], ["Avec l’événement", "idem"], ["Avec le scénario alternatif", "idem"]],
    example: { label: `Réaction réelle (${EXAMPLE_ID}, groupe « ${seg.name} »)`, fields: [["Réaction", quotes[0] ?? "—"], ["Autre réaction", quotes[1] ?? "—"], ["Les trois distributions", "exemple non conservé dans l’artefact : seules les moyennes et les écarts par candidat sont gardés"]] },
  },
  { id: "agg", kind: "code", title: "Agrégation", where: "pipeline/radar/probabilisticResponse.ts", calls: "aucun appel", role: "Pour chaque profil : écart = avec l’événement − sans l’événement. « Plus enclins » / « moins enclins » = profils dont la probabilité d’un candidat bouge d’au moins 2 points. Intervalles de bootstrap, stabilité entre les 2 passes. Écrit l’analyse dans data/generated/analyses/. Aujourd’hui seules les 3 premières réactions de chaque groupe sont conservées." },
  { id: "site", kind: "code", title: "Page événement", where: "src/components/events/EventSubpopulationAnalysis.tsx", calls: "aucun appel", role: "« Évolution simulée des intentions de vote, candidat par candidat » : solde plus/moins enclins par candidat et par groupe. Rendu au build, aucun appel au modèle dans le navigateur." },
  {
    id: "legacy", kind: "llm", legacy: true, title: "Ancienne méthode v1 · direction par bloc", where: "pipeline/radar/relativeResponse.ts", calls: "uniquement avec --method v1 (plus utilisée)",
    role: "Remplacée par D : le modèle ne donnait qu’une direction (vers, loin, pas de changement net) pour chaque bloc politique.",
    system: RELATIVE_SYSTEM,
    input: [["Événement, intervention, comparateur, groupe", "texte"], ["Définition des 5 blocs", "gauche radicale, gauche, centre, droite, extrême droite"], ["Profils", "description de chaque personne"]],
    output: [["Par profil", "direction pour chaque bloc et l’abstention · mécanisme · principale incertitude"]],
  },
];

const fields = (f: Field[]) => `<dl>${f.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;
// one paragraph per sentence: the prompts are long single blocks, this keeps them scannable
const prose = (t: string) => t.split("\n").flatMap((l) => l.split(/(?<=[.!?:;])\s+(?=[A-ZÉÈÀ«•(])/)).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");
const fold = (label: string, body: string, open: boolean, cls: string) => `<details class="fold ${cls}"${open ? " open" : ""}><summary>${esc(label)}</summary><div class="fold-body">${body}</div></details>`;

const card = (s: Stage, i: number) => `
<section class="stage ${s.kind}${s.legacy ? " legacy" : ""}" id="${s.id}">
  <div class="body">
    <p class="tag">${s.kind === "llm" ? "Appel LLM" : "Code, sans LLM"}</p>
    <h2>${esc(s.title)}</h2>
    <p class="meta">${esc(s.calls)} · <code>${esc(s.where)}</code></p>
    <p class="role">${esc(s.role)}</p>
    ${s.system ? fold(`Prompt envoyé au modèle`, prose(s.system), s.kind === "llm" && !s.legacy, "sys") : ""}
    ${(s.variants ?? []).map((v) => fold(v.label, prose(v.text), false, "sys")).join("")}
    ${s.input || s.output ? `<div class="io">
      ${s.input ? `<div class="col in"><h3>Ce qui entre</h3>${fields(s.input)}</div>` : ""}
      ${s.output ? `<div class="col out"><h3>Ce qui doit sortir</h3>${fields(s.output)}</div>` : ""}
    </div>` : ""}
    ${s.example ? `<div class="example"><h3>${esc(s.example.label)}</h3>${fields(s.example.fields)}</div>` : ""}
  </div>
  ${i < stages.length - 1 && !s.legacy ? `<div class="arrow" aria-hidden="true">↓</div>` : ""}
</section>`;

const nav = stages.map((s) => `<a href="#${s.id}" class="${s.kind}${s.legacy ? " legacy" : ""}">${esc(s.title)}</a>`).join("");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Carte des prompts — L’Observatoire</title>
<style>
:root{--bg:#f6f5f1;--card:#fff;--ink:#1c1f1f;--mute:#5d6670;--line:#ddd9cf;--llm:#c2410c;--llm-bg:#fff4ec;--code:#475569;--soft:#f1efe8;--in:#1d4ed8;--out:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#121516;--card:#1b2022;--ink:#e8e6df;--mute:#a1a9b0;--line:#323a3c;--llm:#fb923c;--llm-bg:#2a1f18;--code:#94a3b8;--soft:#14181a;--in:#7aa2ff;--out:#5fd38b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,sans-serif}
header,main{max-width:62rem;margin:0 auto;padding:0 1.2rem}header{padding-top:2rem}
h1{margin:0 0 .5rem;font-size:1.7rem}header p{color:var(--mute);margin:.4rem 0}
nav{position:sticky;top:0;z-index:5;display:flex;gap:.45rem;flex-wrap:wrap;padding:.7rem 1.2rem;background:var(--bg);border-bottom:1px solid var(--line);margin-top:1.4rem}
nav a{font-size:.8rem;padding:.25rem .65rem;border-radius:99px;border:1px solid var(--line);color:var(--ink);text-decoration:none}
nav a.llm{border-color:var(--llm);color:var(--llm)}nav a.legacy{opacity:.55}
main{padding-top:1.5rem;padding-bottom:4rem}
.stage{margin-bottom:.4rem}
.body{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--code);border-radius:10px;padding:1.3rem 1.6rem}
.stage.llm .body{border-left-color:var(--llm);background:linear-gradient(var(--llm-bg),var(--card) 7rem)}
.stage.code .body{padding:1rem 1.6rem}
.stage.legacy{opacity:.7}
.tag{margin:0 0 .2rem;font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--code)}.stage.llm .tag{color:var(--llm);font-weight:700}
h2{margin:0 0 .3rem;font-size:1.35rem}.stage.code h2{font-size:1.1rem}
.meta{margin:0 0 .9rem;color:var(--mute);font-size:.85rem}.role{margin:0 0 1rem;max-width:46rem}
code{font:.8rem ui-monospace,Menlo,monospace}
.arrow{text-align:center;color:var(--mute);font-size:1.6rem;line-height:1;padding:.7rem 0}
.fold{border:1px solid var(--line);border-radius:8px;margin:.8rem 0;background:var(--soft)}
.fold>summary{cursor:pointer;padding:.6rem .9rem;font-weight:600;font-size:.9rem;color:var(--llm)}
.fold-body{padding:.4rem 1.3rem 1rem;border-top:1px solid var(--line);max-height:38rem;overflow:auto}
.fold-body p{margin:.8rem 0;max-width:46rem;line-height:1.75}
.io{display:grid;grid-template-columns:1fr 1fr;gap:1.6rem;margin-top:1.2rem}
@media(max-width:860px){.io{grid-template-columns:1fr}}
h3{margin:0 0 .5rem;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}
.in h3{color:var(--in)}.out h3{color:var(--out)}.example h3{color:var(--mute)}
.example{margin-top:1.4rem;padding:.9rem 1.2rem;border-radius:8px;background:var(--soft);border:1px dashed var(--line)}
dl{margin:0}dt{font-weight:600;font-size:.88rem;margin-top:.9rem}dt:first-child{margin-top:0}dd{margin:.15rem 0 0;color:var(--ink);opacity:.88;max-width:46rem}
</style></head><body>
<header><h1>Carte des prompts</h1>
<p>Modèle épinglé : <code>${esc(PINNED_ANALYSIS_MODEL)}</code>. La méthode actuelle utilise 4 prompts (A, B, C, D) ; l’ancienne méthode v1 est grisée en bas. Orange : appel au modèle ; gris : code sans LLM.</p>
<p>Les prompts sont lus directement dans le code (<code>npm run docs:prompts</code> régénère la page). Les exemples viennent de l’analyse <code>${EXAMPLE_ID}</code>.</p></header>
<nav>${nav}</nav>
<main>${stages.map(card).join("\n")}</main>
</body></html>`;

writeFileSync("docs/prompt-map.html", html);
console.log(`docs/prompt-map.html written (${stages.filter((s) => s.kind === "llm").length} LLM stages)`);
