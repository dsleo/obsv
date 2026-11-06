# Contrats des flux d’entrée — version 1

Les feeds sont des objets JSON `schemaVersion: 1`. Les dates utilisent ISO 8601. Chaque source doit être attribuable et chaque enregistrement a un `id` stable et unique.

## `polls.json`

```json
{
  "schemaVersion": 1,
  "polls": [{
    "id": "institut-date-tour-population",
    "publishedAt": "2026-10-20T08:00:00Z",
    "fieldworkStart": "2026-10-10",
    "fieldworkEnd": "2026-10-12",
    "pollster": "Nom de l’institut",
    "sponsor": "Commanditaire",
    "population": "inscrits",
    "sampleSize": 1200,
    "round": "first",
    "candidateShares": { "candidate-id": 24.0 },
    "source": { "title": "Publication du sondage", "url": "https://example.org/poll" }
  }]
}
```

## `events.json`

```json
{
  "schemaVersion": 1,
  "events": [{
    "id": "evenement-stable",
    "occurredAt": "2026-10-19T12:00:00Z",
    "title": "Titre factuel",
    "summary": "Résumé sourcé",
    "category": "économie",
    "sources": [{ "title": "Source primaire", "url": "https://example.org/source" }],
    "editorialStatus": "reviewed"
  }]
}
```

**Source des sondages par défaut** : `npm run data:collect` lit le CSV quotidien de Sondax (`https://sondax.fr/donnees/sondages-presidentielle-2027.csv`, d’après Wikipédia, CC BY-SA 4.0), adapté par `scripts/lib/sondax.mjs`. Le premier passage récupère tout l’historique (reprise depuis février 2026) ; les passages suivants, planifiés chaque jour par `refresh-data.yml` puis `pages.yml`, actualisent le fichier. Seule la configuration premier tour retenue par Sondax est gardée (une ligne `polls` par sondage). `publishedAt` vaut la fin de terrain, la date de publication n’étant pas fournie. Les sondages sans taille d’échantillon sont écartés et comptés. `POLLS_FEED_URL` remplace cette source par un feed JSON conforme au contrat.

`data/candidates.json` liste les candidats retenus : Sondax renvoie aussi des candidats mineurs ou ponctuels, filtrés à la collecte.

Les URLs de feed doivent servir l’objet correspondant avec ce contrat. `npm run data:collect` télécharge les feeds configurés ; `npm run data:validate` vérifie les champs de base et les identifiants ; `npm run data:prepare` produit `data/generated/snapshot.json` et son manifeste. Les personas, profils détaillés et réponses de modèle ne doivent jamais être inclus dans les feeds du site.

Règles vérifiées (`scripts/lib/validate.mjs`, partagé par `data:collect` et `data:validate`/`data:prepare`) : dates ISO 8601 parsables ; `sampleSize` entier > 0 ; `round` ∈ `first|runoff` ; `candidateShares` numériques dans [0, 100] dont la somme ne dépasse pas 101 ; `source(s)` avec URL `http(s)` ; `editorialStatus` ∈ `draft|reviewed|published|retracted` ; `id` uniques. Si `data/candidates.json` (`{ "candidates": ["id", …] }`) existe, les ids de candidats inconnus sont rejetés. `data:collect` valide chaque flux avant d’écrire dans `data/incoming/` : un flux invalide fait échouer l’étape et conserve le dernier fichier valide. Tests : `node --test scripts/validate.test.mjs`.

Le validateur actuel est volontairement une première barrière structurelle, pas une validation scientifique ni éditoriale. Avant toute publication réelle, les taux, populations, sources, statut de revue et hypothèses d’impact devront passer des contrôles métier et une validation humaine.
