export type ImpactGroup = {
  name: string;
  detail: string;
  flow: string;
  pct: string;
  panel: string;
};

export type RadarEvent = {
  id: string;
  date: string;
  shortDate: string;
  pollDay: number;
  tag: string;
  filter: "budget" | "coalition" | "foreign" | "programme";
  title: string;
  summary: string;
  image: string;
  color: string;
  chartX: number;
  chartY: number;
  impact: {
    value: string;
    label: string;
    group: string;
    groupShare: string;
    concern: string;
    voteEffect: string;
    groups: ImpactGroup[];
  };
  scenario: {
    label: string;
    title: string;
    description: string;
    candidate: string;
    candidateMove: string;
  };
  sources: string;
};

export const radarEvents: RadarEvent[] = [
  {
    id: "vat", date: "8 JUIL. 2026", shortDate: "8 JUIL.", pollDay: 8, tag: "BUDGET", filter: "budget",
    title: "La hausse de la TVA transforme le budget en enjeu électoral",
    summary: "Le gouvernement annonce une hausse du taux normal de TVA dans son projet de budget. Dans le panel, la première question n’est pas celle du déficit, mais de savoir qui paiera avant que les salaires ne suivent.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=82", color: "#ec5b34", chartX: 196, chartY: 236,
    impact: { value: "+1.5", label: "pt de progression pour Le Pen", group: "Exploitants agricoles", groupShare: "12 % du groupe changent de vote", concern: "La hausse des prix du quotidien avant que le pouvoir d’achat ne s’améliore.", voteEffect: "+1,5 pt Le Pen / RN", groups: [
      { name: "Exploitants agricoles", detail: "n = 312 · tous territoires", flow: "Philippe → Le Pen", pct: "12 %", panel: "2,3 %" },
      { name: "Salariés qualifiés", detail: "n = 580 · périurbain", flow: "Abstention → Le Pen", pct: "8 %", panel: "2,3 %" },
      { name: "Artisans et commerçants", detail: "n = 240 · tous territoires", flow: "Retailleau → Le Pen", pct: "6 %", panel: "1,9 %" },
    ] },
    scenario: { label: "SCÉNARIO / POUVOIR D’ACHAT", title: "La taxe devient un référendum sur ceux qui paient.", description: "Un coût immédiat pour les ménages renforce la candidate qui présente la mesure comme la preuve d’un pouvoir déconnecté des préoccupations quotidiennes.", candidate: "Marine Le Pen", candidateMove: "+1,5 pt" },
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ BUDGÉTAIRE / PANEL DE 12 000 PERSONNES",
  },
  {
    id: "left-rupture", date: "29 JUIL. 2026", shortDate: "29 JUIL.", pollDay: 29, tag: "COALITION", filter: "coalition",
    title: "La rupture à gauche transforme l’alliance en enjeu de participation",
    summary: "Les discussions entre sociaux-démocrates et insoumis échouent. Le premier signal n’est pas la naissance d’un nouveau bloc, mais un risque bien connu : des électeurs qui ne voient plus de raison de choisir.",
    image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=82", color: "#718b86", chartX: 360, chartY: 214,
    impact: { value: "+2.1", label: "pts de déplacement vers la gauche", group: "Jeunes diplômés des villes", groupShare: "7 % du groupe se tourne vers l’abstention", concern: "Un vote jugé important sur le plan des idées, mais inutile sur le plan stratégique.", voteEffect: "+1,0 pt Mélenchon / −1,0 pt Glucksmann", groups: [
      { name: "Électeurs de gauche sans proximité partisane", detail: "n = 420 · tous territoires", flow: "Glucksmann → Mélenchon", pct: "9 %", panel: "2,1 %" },
      { name: "Jeunes diplômés des villes", detail: "n = 350 · 25–34 ans", flow: "Glucksmann → Abstention", pct: "7 %", panel: "1,2 %" },
      { name: "Électeurs socialistes réguliers", detail: "n = 610 · tous territoires", flow: "Mélenchon → Glucksmann", pct: "5 %", panel: "0,8 %" },
    ] },
    scenario: { label: "SCÉNARIO / VOTE UTILE", title: "La question de l’alliance devient celle de la participation.", description: "Une candidature unique pourrait remobiliser les électeurs qui souhaitent encore un changement. Un nouvel échec des négociations renforcerait le risque d’abstention.", candidate: "Jean-Luc Mélenchon", candidateMove: "+1,0 pt" },
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ DES ALLIANCES / PANEL DE 12 000 PERSONNES",
  },
  {
    id: "ukraine", date: "14 AOÛT 2026", shortDate: "14 AOÛT", pollDay: 45, tag: "UKRAINE", filter: "foreign",
    title: "Le déploiement en Ukraine ravive le débat entre sécurité et consentement",
    summary: "La France annonce l’envoi d’un contingent de 5 000 personnes dans une force européenne de réassurance. L’annonce fait réagir des électeurs qui s’accordent sur la menace, mais pas sur la réponse à y apporter.",
    image: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=82", color: "#9c8d6a", chartX: 510, chartY: 198,
    impact: { value: "+3.4", label: "pts de déplacement dans le groupe le plus touché", group: "Électeurs de gauche proches du pouvoir", groupShare: "11 % du groupe évoluent", concern: "Soutenir l’Europe sans accepter un engagement militaire sans limite claire.", voteEffect: "+2,0 pts Mélenchon / −2,0 pts Glucksmann", groups: [
      { name: "Électeurs de gauche proches du pouvoir", detail: "n = 1 120 · PS ou vote à gauche en 2024", flow: "Glucksmann → Mélenchon", pct: "11 %", panel: "3,4 %" },
      { name: "Jeunes des villes de 18 à 24 ans", detail: "n = 370 · abstentionnistes réguliers", flow: "Abstention → Mélenchon", pct: "7 %", panel: "2,6 %" },
      { name: "Retraités des zones rurales", detail: "n = 450 · communes de moins de 5 000 habitants", flow: "Le Pen → Abstention", pct: "5 %", panel: "1,1 %" },
    ] },
    scenario: { label: "SCÉNARIO / SÉCURITÉ ET GARDE-FOUS", title: "Le mandat compte autant que la mission.", description: "Le soutien progresse si le déploiement s’inscrit dans un mandat européen clairement défini. Sans ce cadre, le même événement suscite de la lassitude plutôt qu’un élan de solidarité.", candidate: "Jean-Luc Mélenchon", candidateMove: "+2,0 pts" },
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ INTERNATIONALE / PANEL DE 12 000 PERSONNES",
  },
  {
    id: "philippe-programme", date: "2 SEPT. 2026", shortDate: "2 SEPT.", pollDay: 64, tag: "PROGRAMME", filter: "programme",
    title: "Édouard Philippe dévoile son programme : baisse des dépenses et réforme du travail",
    summary: "Édouard Philippe présente un programme fondé sur la baisse des dépenses publiques et une réforme du travail. Son offre se précise, tout comme les arbitrages qu’elle implique.",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82", color: "#577572", chartX: 648, chartY: 166,
    impact: { value: "+2.9", label: "pts de déplacement dans le groupe le plus touché", group: "Professions libérales", groupShare: "13 % du groupe évoluent", concern: "La recherche de compétence et de stabilité, sans nouvelle promesse de rupture.", voteEffect: "+2,0 pts Philippe / −1,5 pt Retailleau", groups: [
      { name: "Professions libérales", detail: "n = 221 · tous territoires", flow: "Retailleau → Philippe", pct: "13 %", panel: "2,9 %" },
      { name: "Cadres du secteur privé", detail: "n = 640 · villes de plus de 100 000 habitants", flow: "Glucksmann → Philippe", pct: "7 %", panel: "2,0 %" },
      { name: "Agents de la fonction publique", detail: "n = 530 · catégories B et C", flow: "Philippe → Abstention", pct: "5 %", panel: "1,4 %" },
    ] },
    scenario: { label: "SCÉNARIO / CRÉDIT ACCORDÉ À LA COMPÉTENCE", title: "Un programme détaillé resserre l’écart.", description: "Le plan attire des électeurs du centre droit lorsque l’accent est mis sur son application. Il en perd lorsque les efforts demandés ne s’accompagnent pas d’un calendrier clair.", candidate: "Édouard Philippe", candidateMove: "+2,0 pts" },
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ PROGRAMMATIQUE / PANEL DE 12 000 PERSONNES",
  },
  {
    id: "pensions", date: "22 SEPT. 2026", shortDate: "22 SEPT.", pollDay: 84, tag: "RETRAITES", filter: "programme",
    title: "Le Pen promet le retour à 62 ans : les retraites à l’épreuve de la crédibilité",
    summary: "Marine Le Pen promet de rétablir l’âge légal de départ à la retraite à 62 ans dès le début du mandat. L’annonce touche au-delà de son électorat habituel, mais de façon inégale.",
    image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=82", color: "#a95a56", chartX: 790, chartY: 112,
    impact: { value: "+3.1", label: "pts de déplacement dans le groupe le plus touché", group: "Exploitants agricoles", groupShare: "15 % du groupe évoluent", concern: "Pouvoir cesser son activité sans perdre ce que l’on a construit.", voteEffect: "+2,0 pts Le Pen / −1,0 pt Retailleau", groups: [
      { name: "Exploitants agricoles", detail: "n = 312 · tous territoires", flow: "Abstention → Le Pen", pct: "15 %", panel: "3,1 %" },
      { name: "Ouvriers non qualifiés", detail: "n = 268 · villes de plus de 100 000 habitants", flow: "Abstention → Le Pen", pct: "10 %", panel: "3,1 %" },
      { name: "Retraités aux faibles pensions", detail: "n = 410 · pension inférieure à 1 400 €", flow: "Retailleau → Le Pen", pct: "6 %", panel: "2,2 %" },
    ] },
    scenario: { label: "SCÉNARIO / PROMESSE DES 62 ANS", title: "Une promesse simple, une facture complexe.", description: "Le message convainc surtout les actifs qui estiment avoir déjà payé le prix de la réforme. Sa crédibilité dépend du financement des cent premiers jours du mandat.", candidate: "Marine Le Pen", candidateMove: "+2,0 pts" },
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ DES RETRAITES / PANEL DE 12 000 PERSONNES",
  },
];

export const pollCandidates = [
  { id: "lepen", name: "Marine Le Pen", short: "Le Pen", party: "RN", color: "#ec5b34", base: 29 },
  { id: "philippe", name: "Édouard Philippe", short: "Philippe", party: "Horizons", color: "#577572", base: 17.5 },
  { id: "glucksmann", name: "Raphaël Glucksmann", short: "Glucksmann", party: "Place publique", color: "#8e7b5e", base: 13.5 },
  { id: "melenchon", name: "Jean-Luc Mélenchon", short: "Mélenchon", party: "LFI", color: "#a95a56", base: 10.5 },
  { id: "retailleau", name: "Bruno Retailleau", short: "Retailleau", party: "LR", color: "#9c8d6a", base: 10 },
  { id: "zemmour", name: "Éric Zemmour", short: "Zemmour", party: "Reconquête", color: "#273033", base: 5 },
] as const;

export const candidateEventImpacts: Record<string, Record<string, number>> = {
  lepen: { vat: 1.5, ukraine: 0.5, pensions: 2 },
  philippe: { vat: -1.5, ukraine: 0.5, "philippe-programme": 2 },
  glucksmann: { "left-rupture": -1, ukraine: -2 },
  melenchon: { vat: 0.5, "left-rupture": 1, ukraine: 2 },
  retailleau: { vat: -0.5, "philippe-programme": -1.5, pensions: -1 },
  zemmour: { pensions: -1 },
};

export function getSmoothedPollValue(candidateId: string, day: number) {
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const poll of pollObservations) {
    const weight = Math.exp(-Math.pow(day - poll.day, 2) / 18);
    weightedTotal += weight * poll.values[candidateId as keyof typeof poll.values];
    totalWeight += weight;
  }
  return totalWeight > 0.35 ? weightedTotal / totalWeight : null;
}

const pollsters = [
  { name: "Ifop", every: 11, offset: 2, bias: { lepen: 0.8 } },
  { name: "Elabe", every: 13, offset: 5, bias: { lepen: -0.5, melenchon: 0.2 } },
  { name: "Odoxa", every: 14, offset: 8, bias: { melenchon: 0.6, philippe: -0.3 } },
  { name: "OpinionWay", every: 12, offset: 4, bias: { philippe: 0.7, zemmour: 0.3 } },
  { name: "Toluna Harris Interactive", every: 15, offset: 10, bias: {} },
];

const eventEffects: Record<number, Record<string, number>> = {
  8: { lepen: 1.5, philippe: -1.5, retailleau: -0.5, melenchon: 0.5 },
  29: { glucksmann: -1, melenchon: 1 },
  45: { melenchon: 2, glucksmann: -2, lepen: 0.5, philippe: 0.5 },
  64: { philippe: 2, retailleau: -1.5 },
  84: { lepen: 2, retailleau: -1, zemmour: -1 },
};

function seededRandom(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seededRandom(2027);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function trend(candidateId: string, base: number, day: number) {
  let value = base + Math.sin(day / 19 + base) * 0.35;
  for (const [eventDay, effects] of Object.entries(eventEffects)) {
    const effect = effects[candidateId];
    if (effect) value += effect * sigmoid((day - Number(eventDay)) / 1.3);
  }
  return value;
}

export const pollObservations = pollsters.flatMap((pollster) => {
  const observations = [];
  for (let day = pollster.offset; day <= 91; day += pollster.every + Math.floor(random() * 3) - 1) {
    const values = Object.fromEntries(pollCandidates.map((candidate) => [
      candidate.id,
      Math.max(1, Math.round(trend(candidate.id, candidate.base, day) + (pollster.bias[candidate.id as keyof typeof pollster.bias] ?? 0) + (random() - 0.5) * 2.2)),
    ])) as Record<(typeof pollCandidates)[number]["id"], number>;
    observations.push({ day, pollster: pollster.name, sample: 900 + Math.round(random() * 9) * 100, values });
  }
  return observations;
}).sort((a, b) => a.day - b.day);
