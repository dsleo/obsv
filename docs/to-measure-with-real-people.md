# À vérifier auprès de vraies personnes (idée pour une prochaine itération)

Each analysed group carries `measurementNeeds`: variables the synthetic personas do not contain
and that a real survey would need to measure to confirm or reject the hypothesis
(e.g. vote intention, media exposure, attitude towards the police).

Removed from the event page UI for now (it read as jargon). Data is still in
`data/generated/analyses/*.json` (`segments[].measurementNeeds`), with French labels in
`src/data/needLabels.json` and `needLabel()` in `src/lib/radar/labels.ts`.

Ideas: a dedicated "protocole de vérification" page; one plain-language sentence per group
("Pour confirmer, il faudrait interroger de vrais jeunes urbains sur…"); aggregate the most
frequent needs across events to design a real survey.
