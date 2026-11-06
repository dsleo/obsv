# L’Observatoire — site statique

Site éditorial en français, conçu pour être généré et servi par GitHub Pages. Le navigateur ne lance aucune analyse, n’appelle aucun modèle et ne contient aucun secret. `npm run build` génère le dossier `out/` avec les pages radar, événements et candidats.

## Développement local

```sh
npm ci
npm run dev
```

## Contrôles et préparation des données

Les collecteurs publient deux JSON versionnés, décrits dans [`docs/data-contracts.md`](docs/data-contracts.md). En local, placez-les sous `data/incoming/` puis lancez :

```sh
npm run data:validate
npm run data:prepare
npm run typecheck
npm run build
```

Les entrées brutes et le snapshot normalisé ne sont pas suivis par Git par défaut. Les feeds configurés dans les variables du dépôt GitHub (`POLLS_FEED_URL`, `EVENTS_FEED_URL`) peuvent être téléchargés par le workflow planifié. Sans ces variables, l’étape de collecte le signale et ne prétend pas avoir obtenu des données réelles.

## GitHub Pages

Le workflow [pages.yml](.github/workflows/pages.yml) valide les types, génère le site statique et déploie `out/` à chaque push sur `main` ou à la demande. Le `basePath` est calculé automatiquement pour le site projet `owner/repo` ; pour `owner.github.io`, la racine est utilisée.

Activer Pages dans **Settings → Pages → Build and deployment → GitHub Actions**. Le dépôt peut rester privé selon le plan GitHub, mais le site Pages doit être traité comme public : tout contenu embarqué dans l’export peut être consulté.

Le workflow [refresh-data.yml](.github/workflows/refresh-data.yml) collecte les feeds configurés, valide le contrat et conserve un snapshot comme artefact Actions. Il ne promeut pas automatiquement de résultats analytiques en production : la revue humaine et l’intégration des collecteurs/moteur sont requises avant de publier des changements de données.

## Analyse des sous-populations (hors ligne)

Le moteur (extraction de segments par tags + contrastes directionnels LLM) a été porté depuis `tweenverse` sans réécriture : `pipeline/radar/` et `src/lib/radar/`. Il tourne uniquement en CLI :

```sh
npm run data:analyze          # OPENAI_API_KEY + index de personas requis, voir .env.example
npm run data:check-analyses   # valide les artefacts data/generated/analyses/*.json
```

Les index `data/radar/*.jsonl` et `geography-2026.json` ne sont pas versionnés et doivent être fournis (non présents dans ce dépôt) ; sans eux la commande s’arrête avec la liste des fichiers manquants. Les artefacts sont lus au build par les pages événement ; sans artefact, la page affiche « Analyse non disponible ».

## État et limites actuels

- L’interface importée est un prototype avec données de démonstration explicitement signalées comme telles.
- Les validateurs et workflows constituent l’ossature d’ingestion et de publication ; ils ne remplacent pas encore les collecteurs de votre collègue.
- La prochaine intégration est de faire produire à ces collecteurs les contrats versionnés, puis de connecter le snapshot validé à l’interface. L’analyse des sous-populations devra tourner comme étape CLI avec versions de méthode, cache par empreinte et revue ; pas comme endpoint utilisateur.
- Les associations événement-candidat ne sont pas des effets causaux. Le site ne doit pas transformer une hypothèse issue de personas synthétiques en variation réelle d’intentions de vote.
