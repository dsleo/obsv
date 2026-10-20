# Ingestion de données

Les collecteurs doivent produire les contrats JSON définis dans `docs/data-contracts.md` : `polls.json` et `events.json`, chacun avec `schemaVersion: 1` et son tableau de lignes. Ces fichiers sont ignorés par Git par défaut pour éviter de publier des exports bruts par accident.

Le workflow planifié sait télécharger des JSON depuis les variables de dépôt `POLLS_FEED_URL` et `EVENTS_FEED_URL`. Sans ces URLs, la validation accepte l’absence de nouvelles données et conserve le site de démonstration. Cette première version ne scrape pas directement de médias ou d’instituts : branchez ici les collecteurs existants après accord sur les contrats.
