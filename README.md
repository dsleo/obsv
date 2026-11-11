# L’Observatoire

Publication éditoriale statique en français : sondages observés, événements sourcés et hypothèses générées à partir de profils synthétiques. L’interface distingue les observations des simulations. Les analyses sont précalculées ; le navigateur ne contient aucune clé et ne lance aucun modèle.

## Démarrer

```sh
npm ci
npm run data:collect       # ELECTION_API_KEY dans .env pour l’API événements
npm run data:prepare
npm run dev
```

`npm run build` prépare les données et exporte le site dans `out/`. `npm start` sert cet export sur http://127.0.0.1:4173, avec la page 404 française. `SITE_PUBLIC=false` garde les aperçus hors indexation.

## Sources et intégrité du fil

Les sondages sont collectés depuis le CSV Sondax (configuration principale au premier tour, taille d’échantillon obligatoire), avec leur notice et les dates du terrain. Le CSV est lu avec un parseur prenant en charge les champs entre guillemets.

Les événements proviennent de l’API election-tracker, implémentée dans [danchemla/sondageTracker](https://github.com/danchemla/sondageTracker). L’adaptateur privilégie son contrat `articles` : titres, éditeurs et résumés originaux de chaque article. Les anciennes `source_descriptions` Google peuvent contenir plusieurs titres concaténés : elles ne sont jamais utilisées comme résumé factuel. Le mode de compatibilité conserve seulement les articles associés au sujet et sépare le premier titre de son média. Sans résumé original fiable, le site renvoie aux sources.

Les contrôles excluent les tests de produits faussement classés comme faits judiciaires et les articles étrangers au sujet du regroupement. La source, son crédit et l’URL sont conservés ensemble. Le nombre de médias affiché correspond aux sources effectivement proposées, pas au cluster d’origine avant filtrage.

La correction amont des règles et du contrat est proposée dans [sondageTracker #16](https://github.com/danchemla/sondageTracker/pull/16). Déployer l’API ne répare pas ses anciens clusters : une reconstruction Gold contrôlée, puis une nouvelle collecte, reste nécessaire. Le site reste protégé par ses contrôles locaux pendant cette transition.

## Publication automatique

`data/publication-policy.json` définit la sélection automatique des événements et la publication automatique des hypothèses. **Aucune relecture humaine obligatoire.** Les mentions publiques décrivent ce mode sans inventer de relecteur.

Un événement importé reste une donnée brute ; seuls les enregistrements explicitement publiés ou passant la politique automatique et ses contrôles qualité entrent dans le snapshot public. Une rétractation prévaut toujours. `data/events-curation.json` peut contenir des listes `pin` et `hide` ; une exclusion qualité ne peut pas être contournée en épinglant un test de produit.

Les feeds manquants, invalides ou anormalement vides sont rejetés sans remplacer le dernier snapshot. `ALLOW_EMPTY_FEEDS=true` sert uniquement aux fixtures intentionnellement vides. Les collections publiques sont typées indépendamment du contenu du JSON. Le navigateur ne reçoit qu’un jeu de données léger pour les graphiques ; les collections d’articles restent dans le rendu serveur/build.

## Analyses hors ligne

Configurer les index locaux et les variables de `.env.example`, puis :

```sh
npm run data:analyze
npm run data:check-analyses
npm run build
```

La génération publie automatiquement un artefact complet avec modèle et méthode épinglés, empreinte des entrées, empreinte de cache du code/configuration pertinent, date de calcul et hash du contenu. Une réponse de modèle manquante empêche la publication partielle. Les fichiers sont remplacés atomiquement. Les événements inchangés réutilisent le cache.

Le build ne présente une hypothèse que si son entrée correspond encore au titre, au résumé factuel et à la source de l’événement public. Résoudre une redirection ne change pas cette identité lorsqu’un identifiant source stable existe. Un contenu modifié, une ancienne entrée ou une méthode incompatible ne sont pas publiés. Les anciens artefacts non liés aux entrées corrigées restent en attente de recalcul ; les démonstrations historiques sont sous `scripts/fixtures/legacy-analyses/`.

Les pourcentages décrivent des **réponses simulées**, sans estimer la proportion réelle des électeurs. Les effets chiffrés `effect` et `altEffect` restent hors publication par défaut tant que la validation n’est pas concluante. Une absence de chiffre publié n’est pas présentée comme un effet nul. Les pages candidat utilisent un contraste global de bloc, sans additionner des groupes exploratoires qui peuvent se recouper.

`npm run trust:refresh` collecte les données, recalcule les expériences de validation et les contrôles, puis complète l’historique de backtest. Il nécessite les index locaux et tourne hors du build Pages. Les index volumineux ne sont pas versionnés ; voir `docs/radar-trust.md` et `docs/radar/` pour le moteur et les limites scientifiques.

## Vérification

```sh
npm test                    # validateurs, collecteurs, publication, durabilité, moteur
npm run typecheck
npm run data:check-analyses
npm run build
npm run smoke
npm run test:browser         # Chromium/Chrome, parcours et axe dans les deux thèmes
npm audit
```

Pour les tests navigateur en CI : `npx playwright install --with-deps chromium`. En local, Chrome est utilisé. Le lanceur détecte automatiquement le préfixe d’un export GitHub Pages. Les tests Python hors ligne utilisent NumPy, SciPy et PyArrow : `python -m unittest discover -s scripts/radar -p 'test_*.py'`.

## Ouverture publique et hébergement

Le workflow Pages collecte, valide, teste et exporte à chaque push sur `main`, à la demande et chaque jour. Il exécute les tests complets, le contrôle des artefacts, les vérifications des routes et les parcours navigateur avant déploiement.

Configurer les variables de dépôt (ou les variables de build sur un autre hébergeur) :

- `SITE_PUBLIC=true` pour l’indexation d’une ouverture publique ; `false` pour un aperçu.
- `SITE_URL` : URL HTTPS publique définitive, avec son éventuel chemin de projet.
- `SITE_PUBLISHER` : identité exacte de l’éditeur.
- `SITE_CONTACT_EMAIL` : adresse publique pour les corrections et les demandes liées aux données.

`npm run release:check` refuse une configuration publique sans ces faits. Ces informations ne sont jamais inventées. L’URL/configuration génère les canoniques, l’image de partage, le sitemap et robots.txt. Sans domaine personnalisé, l’adresse GitHub Pages est dérivée du dépôt. `SITE_BASE_PATH` permet un préfixe explicite si nécessaire.

Les photographies d’actualité ne sont affichées que si `imageRights` vaut `licensed` ou `permission`, avec `imageCredit`. Les URL et le repli photographique local existant sont conservés dans les données ; une URL publique ne constitue pas une autorisation de reproduction. Les pages À propos, corrections et confidentialité décrivent le fonctionnement réel du site.

L’audit initial est dans `docs/audit-2026-11-11/`. L’état des corrections et les limites de vérification sont suivis dans `docs/prelaunch-fixes.md`. L’avis juridique/les droits et les tests sur de vrais appareils restent des vérifications humaines externes, distinctes du mécanisme de publication automatique.
