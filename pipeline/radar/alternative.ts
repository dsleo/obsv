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
Rédigez en français. « description » : le scénario alternatif. « whatChanges » : en une phrase, ce qui change par rapport à l’événement réel et pour quels publics.`;

export async function proposeAlternative(event: { title: string; description: string }): Promise<Alternative> {
  const out = await callStructuredModel({
    schema: alternativeSchema, schemaName: "radar_event_alternative_v1", stageName: "radar_event_alternative", system: SYSTEM,
    user: JSON.stringify({ event: { title: event.title, description: event.description } }), // no date, no URL: only what is needed to judge the event
  });
  return out.data;
}
