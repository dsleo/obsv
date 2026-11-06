# Checklist de production

## Fait dans cette passe

- **Images** : les événements réels n’ont pas d’illustration propre. Quand l’article source est un lien direct, la vignette (`og:image`) est chargée depuis le serveur de l’éditeur à l’exécution (ressource tierce, droits à valider avant publication). Sinon, simple pavé de couleur.
- **Partage et SEO** : titre, description, `og:*` (type `article` pour les événements, `fr_FR`) et `twitter:card` sur les pages racine, événement et candidat (`src/lib/metadata.ts`).
- **Accessibilité, audit automatisé** : axe-core 4.10.2 exécuté dans le navigateur sur `/`, `/events/`, `/events/vat/`, `/events/pensions/`, `/candidates/`, `/candidates/lepen/` (build statique local). Corrections : contraste des textes orange, gris et de l’accent italique ; `role="img"` remplacé par `role="group"` sur le graphique interactif ; `aside` imbriqués remplacés par des sections/divs ; bandeau de démonstration désormais une région nommée. **Résultat final : aucune violation automatique relevée sur ces pages.**

## À faire (non couvert ici)

- **Test sur appareils réels** : non réalisé. Vérifier au minimum iOS Safari, Android Chrome, Firefox desktop, avec le bandeau, le graphique, les tableaux repliables et les pages événement. Un aperçu à 375 px a été contrôlé visuellement, pas un appareil.
- **Lecteur d’écran et clavier** : navigation au clavier des points du graphique (boutons dans un `role="group"`) et annonce des séries simulées avec VoiceOver et NVDA. L’audit automatisé ne couvre qu’une partie des critères WCAG.
- **Licences d’images** : valider juridiquement l’affichage des vignettes d’articles (voir ci-dessus) ; ne pas copier d’images tierces dans le dépôt.
- **URL publique** : `sitemap.xml`, `robots.txt` et `og:image` (PNG ou JPEG) demandent une URL de site définitive, non encore fixée.
- **Revue juridique** : voir [`legal-review.md`](legal-review.md).
