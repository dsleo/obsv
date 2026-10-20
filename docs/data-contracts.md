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

Les URLs de feed doivent servir l’objet correspondant avec ce contrat. `npm run data:collect` télécharge les feeds configurés ; `npm run data:validate` vérifie les champs de base et les identifiants ; `npm run data:prepare` produit `data/generated/snapshot.json` et son manifeste. Les personas, profils détaillés et réponses de modèle ne doivent jamais être inclus dans les feeds du site.

Le validateur actuel est volontairement une première barrière structurelle, pas une validation scientifique ni éditoriale. Avant toute publication réelle, les taux, populations, sources, statut de revue et hypothèses d’impact devront passer des contrôles métier et une validation humaine.
