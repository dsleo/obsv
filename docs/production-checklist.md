# État de préparation — 11 novembre 2026

## Implémenté

- Contrôles des sources et des champs imbriqués, parseur CSV complet et protection du dernier snapshot contre les feeds invalides ou anormalement vides.
- Publication automatique explicite des actualités contrôlées ; les rétractations prévalent. Les métadonnées ne prétendent pas qu’une relecture humaine a eu lieu.
- Publication automatique des hypothèses complètes et valides, liées à leurs entrées factuelles et à un hash du contenu. Aucune relecture humaine obligatoire, conformément au concept du produit.
- Libellé compact de simulation, explication accessible au survol/toucher/clavier, dénominateurs des réponses et détails de méthode. Les effets non publiés ne sont pas présentés comme nuls.
- Graphique avec contrôles de période/comparaison, libellés directs, dates d’observation, tableau sourcé accessible et export CSV. Jeux de données du navigateur séparés des collections d’articles.
- Archive recherchable et filtrable, sélection conservée dans l’URL, états vides et page 404 française.
- Méthode contextualisée, pages À propos/corrections/confidentialité, métadonnées dédiées, sitemap et robots.
- Photos d’actualité non affichées sans droit renseigné ; les URL brutes et le repli local sont conservés. Crédits et images responsives pour les photos autorisées.
- Contrôles de release publique sur l’identité/contact/URL configurés. Les aperçus restent hors indexation.
- Tests complets et navigateur exécutés par le workflow de publication. Dépendances auditées et corrigées.

## À finaliser avec les faits de publication

- Renseigner SITE_PUBLISHER, SITE_CONTACT_EMAIL et SITE_URL, puis SITE_PUBLIC=true pour l’ouverture. L’identité et les coordonnées ne sont pas inventées.
- Fusionner/déployer la correction amont [sondageTracker #16](https://github.com/danchemla/sondageTracker/pull/16), reconstruire les clusters Gold puis recollecter. Les contrôles locaux protègent déjà le site ; les données de production amont n’ont pas été modifiées pendant cette passe.
- Valider le cadre juridique et les droits du projet en utilisant les descriptions techniques actualisées. Cette vérification n’ajoute pas une relecture humaine à la génération des hypothèses.
- Vérifier l’hébergement public effectif, la compression/cache, et les parcours sur iOS Safari/Android Chrome ainsi qu’avec VoiceOver/NVDA. Chromium émulé et axe ne remplacent pas ces essais.

Voir `prelaunch-fixes.md` pour les résultats concrets et les preuves de cette passe.
