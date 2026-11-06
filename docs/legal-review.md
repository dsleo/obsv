# Revue juridique : formulations électorales et sondages

**Statut : non validé.** Ce document est une liste de contrôle pour un juriste. Il ne constitue pas un avis juridique et ne doit pas être traité comme tel.

## Ce qui a été fait dans le code

- Les séries d’intentions de vote fictives ne portent pas de noms d’instituts de sondage réels (`src/data/radarData.ts` : « Série simulée 1 à 5 »). Les noms réels ont été retirés délibérément : une série inventée ne doit pas être attribuée à un institut existant.
- Le wording « sondage » reste celui du site (graphiques, tableaux ; le bandeau de démonstration a été retiré). Le juriste doit valider cette formulation, car elle sera publiée telle quelle.
- Le test `src/lib/radar/wording.test.ts` échoue si un nom d’institut réel réapparaît dans `src/`.

## Questions pour le juriste

1. **Qualification.** Une série simulée publiée sur un site d’information relève-t-elle de la définition d’un sondage (loi n° 77-808 du 19 juillet 1977 et ses modifications) ? Faut-il des mentions obligatoires (commanditaire, méthode, taille d’échantillon, dates) ou une interdiction de publication pendant la période réglementée ?
2. **Période de campagne.** Le site doit-il suspendre ou restreindre les séries et les analyses pendant la période prévue par le Code électoral (notamment les règles de publicité et de communication en campagne) ?
3. **Confusion possible.** Les graphiques « Intentions de vote » et les titres d’onglets peuvent-ils être lus comme des sondages ? Proposer une formulation alternative si oui.
4. **Hypothèse visible.** Le libellé « hypothèse » doit-il apparaître sur chaque vue qui affiche un groupe, un pourcentage de direction ou un graphique ? Liste à compléter : accueil, pages événement, pages candidat, export.
5. **Données tierces.** Vérifier les licences et conditions de réutilisation : Nemotron-Personas-France (NVIDIA), Voter Autrement 2022 (Zenodo), résultats électoraux (data.gouv.fr, Licence Ouverte), INSEE (RP 2022, COG, grille de densité). Vérifier aussi les conditions d’accès à CEVIPOF ENEF 2024, qui n’est pas utilisé.
6. **Formulations à relire.** Phrases d’analyse de `src/components/events/*` et `src/components/radar/MethodExplainer.tsx` (« faire évoluer les probabilités », « ce que cela pourrait changer »).

## Validation

| Date | Relecteur | Périmètre | Décision |
| --- | --- | --- | --- |
| — | — | — | En attente |
