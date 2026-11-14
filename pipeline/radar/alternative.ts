// ONE counterfactual per EVENT (not per segment): a close alternative version of the same event that would plausibly have moved
// voters differently. It lets us ask "what in this event matters?" (event vs alternative), next to "does the event matter at all?" (event vs nothing).
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";

export const alternativeSchema = z.object({ description: z.string(), whatChanges: z.string() });
export type Alternative = z.infer<typeof alternativeSchema>;

const SYSTEM = `Vous recevez un événement réel de la campagne présidentielle française (titre et description). Proposez UN scénario alternatif PROCHE : une variante plausible du même événement, qui aurait eu un impact différent sur les électeurs. Faites varier un seul élément clé : l’issue, l’acteur, le ton ou le contenu de la mesure, le calendrier, l’ampleur. Le scénario alternatif doit rester dans le même domaine que l’événement : ce n’est JAMAIS l’absence d’événement ni une action sans rapport (atelier, dialogue, campagne de communication). Il doit être formulé comme un fait précis, au même niveau de détail que l’événement.
Exemples (illustratifs, ne les recopiez pas) :
- Événement : « Le groupe communiste à l’Assemblée annonce soutenir Mélenchon ». Alternative : « Le groupe communiste annonce présenter son propre candidat et refuse de soutenir Mélenchon » ; ce qui change : la gauche reste divisée au lieu de se rassembler derrière un candidat.
- Événement : « Attal propose une grande primaire des démocrates ». Alternative : « Attal annonce sa candidature en solo, sans primaire » ; ce qui change : le camp central se fragmente au lieu de chercher un candidat commun.
- Événement : « Un candidat propose de relever l’âge de départ à la retraite à 65 ans ». Alternative : « Le même candidat propose de maintenir l’âge à 62 ans mais d’allonger la durée de cotisation » ; ce qui change : l’effort est présenté différemment et touche d’autres publics.
Règles strictes : (1) N’introduisez AUCUN nom de personne, d’organisation, de lieu ou de fait absent de l’événement (pas de nouvelle candidature, rencontre, suspension, attaque ou démission inventée) ; modifiez seulement ce que l’événement contient déjà. (2) Variez un FAIT observable : l’issue (accepte/refuse, retire/maintient), le contenu ou le chiffre d’une mesure, le calendrier, l’ampleur, la décision ou le résultat. Ne réécrivez jamais une interaction privée ou son ton : pas de dîner, de débat familial, de dialogue apaisé, de compréhension mutuelle, de formulation plus conciliante. (3) Le changement doit pouvoir expliquer pourquoi la réponse de certains groupes différerait de celle suscitée par le fait réel. (4) Soyez précis : nommez les acteurs déjà présents, pas « un des candidats » ; aucune mention de médias.
Rédigez en français. « description » : le scénario alternatif. « whatChanges » : en une phrase, ce qui change par rapport à l’événement réel et pour quels publics.`;

const STOP = new Set("le la les un une des de du d l et en au aux à a ce cet cette ces il elle ils elles on se sa son ses leur leurs qui que quoi dont où par pour sur sous dans avec sans entre vers chez plus au lieu non pas ne n y est sont a été sera lors suite après avant mais ou donc or ni car si comme alors puis même tout tous toute toutes présidentielle france français française assemblée nationale parti gouvernement ministre premier président candidat candidate candidats primaire gauche droite centre république".split(" "));
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const content = (t: string) => new Set(norm(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));

/** Deterministic quality flags for an alternative scenario (also used by scripts/review-alternatives.ts). */
export function alternativeFlags(event: { title: string; description: string }, alt: Alternative): string[] {
  const flags: string[] = [];
  const everyWord = new Set(norm(`${event.title} ${event.description}`).split(/[^a-z0-9]+/).filter(Boolean)); // all words, short ones included ("Pen", "Luc")
  const candidates = [...new Set(alt.description.match(/(?<![.!?]\s)(?<!^)\b[A-ZÉÈÀÂÎÔÛÇ][\p{L}'’-]{2,}/gu) ?? [])];
  const names = candidates.filter((w) => !STOP.has(norm(w)) && norm(w).split(/[^a-z0-9]+/).filter((part) => part.length > 2).some((part) => !everyWord.has(part) && !STOP.has(part)));
  if (names.length) flags.push(`nom_nouveau: ${names.slice(0, 4).join(", ")}`);
  if (/(?:ton|débat|échange|discussion|dialogue).{0,55}(?:apais|conciliant|modér|consensuel|mesur|constructif|compréhension)/i.test(`${alt.description} ${alt.whatChanges}`) || /dîner familial|dialogue intergénérationnel/i.test(`${alt.description} ${alt.whatChanges}`)) flags.push("ton_seul");
  if (/un des candidats|certains candidats|plusieurs candidats|quelqu’un|quelqu'un/i.test(alt.description)) flags.push("vague");
  if (/relay[ée]e? par|20 minutes|france 24|selon /i.test(alt.description)) flags.push("meta_media");
  const a = content(alt.description), e = content(event.title);
  const overlap = [...e].filter((w) => a.has(w)).length / (e.size || 1);
  if (overlap > 0.9 && alt.description.length < event.title.length * 1.3) flags.push("quasi_copie");
  if (overlap < 0.2) flags.push("hors_sujet");
  return flags;
}

export async function proposeAlternative(event: { title: string; description: string }): Promise<Alternative> {
  // Up to 3 attempts: the check feeds back what was wrong; the least-flagged attempt wins.
  let best: { alt: Alternative; flags: string[] } | null = null, feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await callStructuredModel({
      schema: alternativeSchema, schemaName: "radar_event_alternative_v2", stageName: "radar_event_alternative", system: SYSTEM,
      user: JSON.stringify({ event: { title: event.title, description: event.description }, ...(feedback ? { retour_sur_la_proposition_precedente: feedback } : {}) }), // no date, no URL
    });
    const flags = alternativeFlags(event, out.data);
    if (!best || flags.length < best.flags.length) best = { alt: out.data, flags };
    if (!flags.length) break;
    feedback = `Rejetée (${flags.join(" ; ")}). Reformulez en suivant les règles strictes : aucun nom ni fait nouveau, un changement précis de contenu, d’issue, d’acteur ou de calendrier, pas seulement le ton.`;
  }
  return best!.alt;
}

export { SYSTEM as ALTERNATIVE_SYSTEM }; // read by scripts/prompt-map.ts
