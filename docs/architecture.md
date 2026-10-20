# Architecture cible — Observatoire électoral statique

## Décision

Séparer le produit en deux livrables :

1. **Pipeline éditorial hors ligne** : collecte, normalisation, validation, analyse des événements, calcul des indicateurs, puis publication d’un snapshot versionné.
2. **Site statique** : lit un snapshot déjà produit et présente radar, fil, pages événement et pages candidat. Aucun appel au modèle, index de personas, secret, base de données ou serveur applicatif ne se trouve dans le parcours public.

Le premier déploiement peut conserver Next.js comme générateur de pages statiques (`output: "export"`) : cela évite une réécriture de l’interface. Un site Vite n’apporterait pas de bénéfice architectural déterminant à ce stade. En revanche, il faut retirer du build public les routes API Node, les accès `server-only` et les pages non exportables. Les pages événement et candidat sont générées à partir du snapshot avec `generateStaticParams`.

## Schéma du flux

```text
Collecte des sondages ─┐
                      ├─> données brutes ─> normalisation/validation ─┐
Collecte des actus ───┘                                              │
                                                                     v
Référentiel personas + méthode versionnée ─> analyse par événement ─> contrôles éditoriaux
                                                                     │
                                                                     v
                 snapshot JSON + manifeste + sources + rapports ─> site statique
                                                                     │
                                                                     v
                                                            hébergement CDN
```

Les collecteurs de sondages et d’événements peuvent être développés séparément. Ils n’ont besoin de se coordonner que sur les contrats de données ci-dessous. La publication ne consomme que des données validées et n’exécute pas les collecteurs.

## Dépôt et responsabilités

```text
src/
  app/                         interface statique, composants et routes
  lib/contracts/               schémas partagés (Zod/TypeScript)
  data/generated/              point d’entrée des données du snapshot en développement
pipeline/
  adapters/polls/              adaptateurs des fournisseurs de sondages
  adapters/events/             adaptateurs des flux d’actualité
  normalize/                   normalisation des unités, dates, candidats, sources
  analysis/                    segments, échantillonnage, scénarios et agrégations
  validate/                    contrôles de qualité et garde-fous de publication
  publish/                     génération atomique du snapshot statique
data/
  raw/                         données collectées immuables, exclues du site
  processed/                   données normalisées et résultats intermédiaires
  snapshots/<snapshot-id>/     seuls fichiers publics publiés
```

Les secrets des fournisseurs et du modèle restent uniquement dans l’environnement du pipeline. `data/raw`, personas et journaux détaillés ne sont jamais copiés dans le répertoire public.

## Contrats de données

Tous les contrats sont versionnés (`schemaVersion`) et les identifiants sont stables.

### Sondage normalisé (`PollObservation`)

```ts
type PollObservation = {
  id: string;
  fieldwork: { start: string; end: string };
  publishedAt: string;
  pollster: string;
  sponsor?: string;
  population: "registered_voters" | "likely_voters" | "adults";
  sampleSize: number;
  round: "first" | "runoff";
  candidateShares: Record<string, number>;
  undecidedShare?: number;
  source: SourceRef;
  quality: { status: "verified" | "provisional" | "excluded"; notes?: string[] };
};
```

Les observations gardent les valeurs originales. Le lissage, les filtres de période, les intervalles et l’éventuelle agrégation sont calculés séparément et documentés ; le site ne reconstitue jamais les points depuis des chaînes formatées.

### Événement (`NewsEvent`)

```ts
type NewsEvent = {
  id: string;
  occurredAt: string;
  updatedAt?: string;
  title: string;
  summary: string;
  body?: string;
  category: string;
  image?: { src: string; alt: string; credit?: string };
  sources: SourceRef[];
  editorialStatus: "draft" | "reviewed" | "published" | "retracted";
};
```

### Analyse d’événement (`EventAnalysis`)

```ts
type EventAnalysis = {
  eventId: string;
  schemaVersion: number;
  methodVersion: string;
  computedAt: string;
  inputHash: string;
  evidenceGrade: "hypothesis" | "survey_supported" | "observed_association";
  exposedGroups: Array<{
    id: string;
    label: string;
    mechanism: string;
    filter: { all: string[]; any: string[]; none: string[] };
    sample: { matched: number; analyzed: number; frame: string };
    scenario: { intervention: string; comparator: string; outcome: string };
    directionalResponses?: Record<string, { toward: number; away: number; unchanged: number }>;
    candidateAssociation?: Record<string, number>;
    caveats: string[];
  }>;
  sources: SourceRef[];
};

type SourceRef = { id: string; publisher: string; title: string; url: string; accessedAt: string };
```

`candidateAssociation` ne doit être fourni que si une méthode défendable le calcule à partir de données adaptées. Le code actuel produit des directions hypothétiques par bloc et profils synthétiques ; il ne calcule ni transfert de vote représentatif ni effet causal. L’interface doit afficher cette distinction et omettre ce champ tant qu’il n’existe pas.

### Snapshot publié

```ts
type Snapshot = {
  schemaVersion: number;
  snapshotId: string; // horodatage UTC + hash de contenu
  generatedAt: string;
  sourcesUpdatedThrough: string;
  methodVersions: Record<string, string>;
  polls: PollObservation[];
  events: NewsEvent[];
  analysesByEventId: Record<string, EventAnalysis>;
  candidates: Array<{ id: string; name: string; party?: string; color: string }>;
};
```

Pour limiter le poids initial, le site peut publier un manifeste léger et un fichier JSON par événement/candidat, tous immuables et nommés par snapshot. Une première version peut utiliser un seul JSON si sa taille reste raisonnable.

## Pipeline CLI et checkpoints

Commandes visées (à introduire progressivement) :

```sh
npm run data:collect                 # exécute les collecteurs configurés
npm run data:normalize               # construit les objets canoniques
npm run data:analyze                 # calcule analyses et agrégats manquants
npm run data:validate                # contrôles, rapport, code de sortie non nul si blocant
npm run data:publish                 # crée un nouveau snapshot prêt à servir
npm run site:build                   # génère les pages statiques depuis ce snapshot
npm run release:preview              # pipeline complet sans promotion en production
```

Principes d’exécution :

- Chaque étape lit une version d’entrée explicite et écrit dans un répertoire de run séparé ; elle ne modifie pas le snapshot actuellement servi.
- L’`inputHash` couvre l’événement, les sondages de la fenêtre concernée, l’index, la géographie, les prompts et la méthode. Une analyse n’est recalculée que si cette empreinte change ou si on la force.
- Les sorties d’étape sont reprenables. Une erreur de collecte n’efface pas les dernières données valides ; elle est consignée avec source, date et raison.
- `validate` contrôle les schémas, les doublons, les sources manquantes, les dates, les bornes de pourcentages, les candidats inconnus, les tailles d’échantillon et la fraîcheur.
- La publication est atomique : valider le snapshot candidat, générer le site, puis promouvoir le nouveau répertoire. En cas d’échec, le dernier snapshot servi reste intact.
- Les analyses génératives sont enregistrées en artefacts avec modèle, version de prompt, méthode, hash d’entrée et résultat structuré. Aucun calcul n’est déclenché à l’ouverture d’une page.

## API — contrats, pas un serveur web

Dans la cible statique, le contrat entre pipeline et site est le schéma JSON publié. Les composants consomment des fonctions pures et typées, par exemple :

```ts
getSnapshotManifest(): Promise<SnapshotManifest>
getPollSeries(candidateIds, { from, to }): PollObservation[]
listEvents({ category, after, before }): NewsEvent[]
getEvent(eventId): NewsEvent | undefined
getEventAnalysis(eventId): EventAnalysis | undefined
getCandidateProfile(candidateId): CandidateProfile
```

Ces fonctions lisent les JSON générés ; elles ne font ni calcul scientifique, ni accès à un modèle. Les URL d’API actuellement ajoutées — `POST /api/radar/analyze` et `POST /api/radar/group-response` — restent utiles pour le banc d’essai et la production d’artefacts, mais doivent sortir du site public quand le chemin éditorial est migré. Le pipeline les appelle directement comme modules, ou les remplace par les mêmes fonctions de domaine ; il ne s’auto-appelle pas via HTTP.

## Parcours utilisateur

- `/` : dernier snapshot, courbes de sondages observés et repères d’événements associés.
- `/events/` : fil chronologique construit au build.
- `/events/<id>/` : article, sources, publics concernés, scénario et niveau de preuve.
- `/candidates/<id>/` : série de sondages et événements reliés, avec attribution uniquement si elle est réellement mesurée.

Filtres, sélection d’une courbe, navigation et accordéons restent interactifs dans le navigateur, sans serveur. Les pages statiques affichent la date du snapshot et son statut de fraîcheur. Une analyse absente ou invalide donne un état explicite, pas un recalcul silencieux.

## Déploiement et cadence

1. Collecte planifiée (ex. quotidienne) et collecte manuelle à la demande pour les breaking news.
2. Pipeline sur données brutes, normalisation, analyses invalidées par hash, validation et aperçu.
3. Revue humaine obligatoire des événements, sources et analyses avant publication.
4. Génération statique, smoke test des routes/liens, puis publication CDN atomique.

Une source de sondages ou d’événements en panne peut retarder les nouvelles données sans rendre le site indisponible. Le site continue de servir le dernier snapshot validé et annonce son ancienneté.

## Migration proposée

1. **Geler les contrats** : introduire les types communs et un petit snapshot de fixture, sans changer l’apparence.
2. **Extraire les données de l’interface** : remplacer `radarData.ts` (démonstration intégrée) par un adaptateur `SnapshotRepository` ; conserver une fixture de démonstration étiquetée.
3. **Ajouter le producteur hors ligne** : transformer `analyzeRadarEvent` et `evaluateSegmentContrast` en étapes invocables depuis CLI, avec cache d’artefacts par hash et rapport de validation.
4. **Brancher les collecteurs collègues** : chacun livre des fichiers conformes à `PollObservation` et `NewsEvent`, avec sources et qualité.
5. **Exporter statiquement** : construire toutes les pages depuis le snapshot ; retirer les routes API du build déployé.
6. **Publier avec revue** : prévisualisation, validation, revue, promotion, conservation du précédent snapshot pour rollback.

Ne pas commencer par réécrire React/Next ni par ajouter une base de données. Le point de bascule est le contrat stable entre collecte, pipeline et snapshot ; le front-end peut ensuite rester très simple.
