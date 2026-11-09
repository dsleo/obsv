# Checklist de production

## Fait dans cette passe

- **Images** : la vignette d’un événement vient de l’API (`representative_image_url` / `source_image_urls`), sinon de l’`og:image` de la page de l’éditeur. Les liens Google News sont décodés à la collecte (`resolveGoogleUrl`, point d’accès Google non officiel : s’il casse, on retombe sur l’API puis sur un pavé de couleur). Les vignettes restent des ressources tierces chargées depuis le serveur de l’éditeur : **droits à valider avant publication**, et le décodage / la lecture des pages éditeurs relève de notre côté (à faire porter par l’API : URL résolue + `image_url`).
- **Partage et SEO** : titre, description, `og:*` (type `article` pour les événements, `fr_FR`) et `twitter:card` sur les pages racine, événement et candidat (`src/lib/metadata.ts`).
- **Accessibilité, audit automatisé** : axe-core 4.10.2 exécuté dans le navigateur sur `/`, `/events/`, `/events/vat/`, `/events/pensions/`, `/candidates/`, `/candidates/lepen/` (build statique local). Corrections : contraste des textes orange, gris et de l’accent italique ; `role="img"` remplacé par `role="group"` sur le graphique interactif ; `aside` imbriqués remplacés par des sections/divs ; bandeau de démonstration désormais une région nommée. **Résultat final : aucune violation automatique relevée sur ces pages.**

## À faire (non couvert ici)

- **Test sur appareils réels** : non réalisé. Vérifier au minimum iOS Safari, Android Chrome, Firefox desktop, avec le bandeau, le graphique, les tableaux repliables et les pages événement. Un aperçu à 375 px a été contrôlé visuellement, pas un appareil.
- **Lecteur d’écran et clavier** : navigation au clavier des points du graphique (boutons dans un `role="group"`) et annonce des séries simulées avec VoiceOver et NVDA. L’audit automatisé ne couvre qu’une partie des critères WCAG.
- **Licences d’images** : valider juridiquement l’affichage des vignettes d’articles (voir ci-dessus) ; ne pas copier d’images tierces dans le dépôt.
- **URL publique** : `sitemap.xml`, `robots.txt` et `og:image` (PNG ou JPEG) demandent une URL de site définitive, non encore fixée.
- **Revue juridique** : voir [`legal-review.md`](legal-review.md).
