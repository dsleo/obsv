"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, BarChart3, BrainCircuit, MapPinned, Newspaper, UsersRound } from "lucide-react";
import { pollCandidates, radarEvents } from "../../data/radarData";
import "./method-explainer.css";

const chapters = [
  {
    title: "Une population, des trajectoires de vote",
    text: "Le point de départ est une population synthétique qui représente la diversité des profils en France. À part, les enquêtes passées nous apprennent comment les intentions de vote se répartissent.",
    eyebrow: "CONSTRUIRE LE TERRAIN D’ÉTUDE",
    scene: "sources",
  },
  {
    title: "Apprendre des intentions passées",
    text: "Un modèle apprend à partir de ces réponses, puis les applique à la population synthétique. Chaque profil reçoit son propre vecteur de probabilités — une estimation, pas une certitude individuelle.",
    eyebrow: "ESTIMER PROFIL PAR PROFIL",
    scene: "model",
  },
  {
    title: "Ancrer l’estimation dans chaque commune",
    text: "Les probabilités individuelles sont ajustées pour retrouver les résultats électoraux observés localement. Le modèle national prend ainsi en compte les réalités de chaque territoire.",
    eyebrow: "CALER SUR LE VOTE OBSERVÉ",
    scene: "calibration",
  },
  {
    title: "Une actualité ne touche pas tout le monde de la même façon",
    text: "À partir d’un événement, le système suggère les sous-populations potentiellement concernées, puis les retrouve dans la population enrichie. Ici, la hausse de TVA est un exemple de démonstration.",
    eyebrow: "FAIRE LE LIEN AVEC L’ACTUALITÉ",
    scene: "event",
  },
  {
    title: "Des vecteurs individuels à l’effet agrégé",
    text: "Pour les profils concernés, le vecteur d’intentions est réévalué. L’agrégation des variations fournit une estimation de l’effet possible sur les candidats — distincte d’un sondage ou d’un résultat observé.",
    eyebrow: "MESURER UN EFFET ESTIMÉ",
    scene: "impact",
  },
] as const;

const people = Array.from({ length: 36 }, (_, index) => index);
const candidateColors = pollCandidates.slice(0, 5).map((candidate) => candidate.color);

function PopulationDots({ highlighted = false }: { highlighted?: boolean }) {
  return <div className={`method-people ${highlighted ? "is-targeted" : ""}`} aria-hidden="true">
    {people.map((person) => <i className={highlighted && person % 6 === 1 ? "is-highlighted" : ""} key={person} style={{ "--person-index": person } as CSSProperties} />)}
  </div>;
}

function DataFlow({ vertical = false }: { vertical?: boolean }) {
  return <div className={`method-data-flow ${vertical ? "is-vertical" : ""}`} aria-hidden="true"><span /><span /><span /></div>;
}

function VisualScene({ scene, active, reducedMotion }: { scene: (typeof chapters)[number]["scene"]; active: boolean; reducedMotion: boolean }) {
  const event = radarEvents.find((item) => item.id === "vat");
  const group = event?.impact.groups[0];
  return <motion.div key={scene} className={`method-visual-scene scene-${scene}`} initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}>
    <div className="method-visual-meta"><span>DE LA DONNÉE À L’INTENTION DE VOTE</span><span>{scene === "event" || scene === "impact" ? "EXEMPLE FICTIF" : "REPRÉSENTATION SCHÉMATIQUE"}</span></div>

    {scene === "sources" && <div className="method-source-layout">
      <div className="method-input-stack">
        <motion.div className="method-source-slip" animate={active && !reducedMotion ? { x: [0, 5, 0] } : {}} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}><UsersRound /><div><b>Population synthétique</b><small>Des profils représentatifs de la France</small></div></motion.div>
        <motion.div className="method-source-slip method-source-polls" animate={active && !reducedMotion ? { x: [0, 5, 0] } : {}} transition={{ duration: 2.6, delay: 0.3, repeat: Infinity, ease: "easeInOut" }}><BarChart3 /><div><b>Enquêtes passées</b><small>Intentions observées dans le temps</small></div></motion.div>
      </div>
      <DataFlow />
      <div className="method-population-result"><PopulationDots /><div><b>Des profils individuels</b><small>La base du modèle</small></div></div>
    </div>}

    {scene === "model" && <div className="method-model-layout">
      <div className="method-poll-archive"><span className="method-mini-kicker">INTENTIONS PASSÉES</span><div className="method-mini-chart"><i /><i /><i /><i /></div><small>Réponses recueillies par les enquêtes</small></div>
      <DataFlow />
      <motion.div className="method-model-core" animate={active && !reducedMotion ? { y: [0, -4, 0] } : {}} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}><BrainCircuit /><b>Le modèle</b><small>apprend les régularités observées</small></motion.div>
      <DataFlow />
      <div className="method-profile-vector"><span className="method-mini-kicker">UN PROFIL</span><b>Vecteur d’intentions</b><div className="method-probabilities">{candidateColors.map((color, index) => <motion.i key={color} style={{ backgroundColor: color }} animate={active && !reducedMotion ? { scaleY: [0.65, 1, 0.75], opacity: [0.65, 1, 0.7] } : {}} transition={{ duration: 1.7, delay: index * 0.12, repeat: Infinity }} />)}<small>[ p₁ · p₂ · … · pₙ ]</small></div><small>Une probabilité par candidat</small></div>
    </div>}

    {scene === "calibration" && <div className="method-calibration-layout">
      <div className="method-calibration-input"><span className="method-mini-kicker">PROFILS ESTIMÉS</span><PopulationDots /><small>Intentions individuelles</small></div>
      <div className="method-calibration-machine"><MapPinned /><b>Calage local</b><small>La distribution s’ajuste</small><DataFlow /></div>
      <div className="method-calibration-output"><span className="method-mini-kicker">VOTE OBSERVÉ DANS LA COMMUNE</span><div className="method-local-bars">{pollCandidates.slice(0, 5).map((candidate, index) => <div key={candidate.id}><span>{candidate.short}</span><div><motion.i style={{ backgroundColor: candidate.color, transformOrigin: "left" }} animate={active && !reducedMotion ? { scaleX: [0.22 + index * 0.08, 0.82 - index * 0.09] } : { scaleX: 0.56 }} transition={{ duration: 1.35, delay: index * 0.11, repeat: Infinity, repeatType: "reverse" }} /></div></div>)}</div><small>Les profils reflètent le contexte territorial</small></div>
    </div>}

    {scene === "event" && <div className="method-event-layout">
      <motion.article className="method-news-cutting" animate={active && !reducedMotion ? { y: [4, 0, 4], rotate: [-0.4, 0, -0.4] } : {}} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
        <span><Newspaper /> L’ACTUALITÉ · BUDGET</span><b>{event?.title ?? "La hausse de TVA et ses effets"}</b><small>Un événement à confronter aux profils de la population.</small>
      </motion.article>
      <DataFlow />
      <div className="method-event-target"><span className="method-mini-kicker">PROFILS POTENTIELLEMENT CONCERNÉS</span><PopulationDots highlighted /><b>{group?.name ?? "Sous-population suggérée"}</b><small>{group?.pct ?? "—"} · illustration fictive</small></div>
    </div>}

    {scene === "impact" && <div className="method-impact-layout">
      <div className="method-person-vector"><span className="method-mini-kicker">AVANT</span><div className="method-vector-formula"><b>vᵢ</b><span>=</span><span>[ p₁ · p₂ · … · pₙ ]</span></div><small>Intentions estimées pour un profil</small></div>
      <motion.div className="method-vector-transform" animate={active && !reducedMotion ? { x: [0, 8, 0] } : {}} transition={{ duration: 1.6, repeat: Infinity }}><ArrowRight /><span>ÉVÉNEMENT</span></motion.div>
      <div className="method-person-vector is-updated"><span className="method-mini-kicker">APRÈS · ESTIMATION</span><div className="method-vector-formula"><b>vᵢ′</b><span>=</span><span>[ p₁+Δ₁ · … · pₙ+Δₙ ]</span></div><small>Intentions réévaluées pour le profil</small></div>
      <div className="method-impact-result"><span className="method-mini-kicker">PUIS, ON AGRÈGE</span><b>{event?.impact.voteEffect ?? "Effet estimé"}</b><small>{group?.name ?? "Profils concernés"}</small></div>
    </div>}
    <div className="method-visual-footer"><ArrowDownRight /><span>{scene === "impact" ? "Une estimation de modèle, pas un sondage" : "Suivez le fil pour voir la suite"}</span></div>
  </motion.div>;
}

export function MethodExplainer() {
  const reduceMotion = useReducedMotion();
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const nodes = chapterRefs.current.filter((node): node is HTMLElement => node !== null);
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const index = nodes.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActiveChapter(index);
      }
    }, { rootMargin: "-35% 0px -40% 0px", threshold: [0.05, 0.2, 0.45, 0.7] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return <MotionConfig reducedMotion="user">
    <section className="method-section" id="method" aria-labelledby="method-title">
      <header className="method-heading">
        <div><span className="method-kicker"><i /> DÉCRYPTAGE</span><h2 id="method-title">Comment ça <em>marche&nbsp;?</em></h2></div>
        <p>Des données électorales à l’évolution estimée des intentions de vote après un événement.</p>
      </header>

      <div className="method-story-layout">
        <div className="method-chapters">
          {chapters.map((chapter, index) => <article className={`method-chapter ${activeChapter === index ? "is-current" : ""}`} key={chapter.scene} ref={(node) => { chapterRefs.current[index] = node; }}>
            <span className="method-chapter-rule" aria-hidden="true" />
            <div className="method-chapter-copy"><span className="method-story-label">{chapter.eyebrow}</span><h3>{chapter.title}</h3><p>{chapter.text}</p></div>
          </article>)}
        </div>

        <aside className="method-sticky-visual" aria-label="Illustration animée du pipeline">
          <div className="method-visual-masthead"><span>LE PARCOURS DES DONNÉES</span><span>{String(activeChapter + 1).padStart(2, "0")} / 05</span></div>
          <div className="method-visual-window" aria-live="polite" aria-atomic="true">
            <VisualScene scene={chapters[activeChapter].scene} active={!reduceMotion} reducedMotion={Boolean(reduceMotion)} />
          </div>
          <div className="method-progress" aria-hidden="true"><i style={{ transform: `scaleX(${(activeChapter + 1) / chapters.length})` }} /></div>
        </aside>
      </div>
      <p className="method-caveat">Les chiffres et exemples présentés ici sont fictifs. Ils illustrent le fonctionnement du pipeline, pas des effets électoraux établis.</p>
    </section>
  </MotionConfig>;
}
