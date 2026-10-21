"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, BrainCircuit, MapPinned, Newspaper, Pause, Play, RotateCcw, UsersRound } from "lucide-react";
import { pollCandidates, radarEvents } from "../../data/radarData";
import "./method-explainer.css";

const stages = [
  {
    nav: "Les données",
    label: "LE POINT DE DÉPART",
    title: "Former une population de référence",
    description: "Une population synthétique représente la diversité des profils en France. Un jeu de données distinct rassemble les intentions de vote passées.",
    scene: "sources",
  },
  {
    nav: "Le modèle",
    label: "L’APPRENTISSAGE",
    title: "Apprendre les intentions de vote",
    description: "Le modèle apprend à partir des intentions passées, puis l’applique aux profils synthétiques pour estimer un vecteur de probabilités par personne.",
    scene: "model",
  },
  {
    nav: "Le calage local",
    label: "L’ANCRAGE TERRITORIAL",
    title: "Ajuster les probabilités à chaque commune",
    description: "Notre algorithme recale les probabilités individuelles pour retrouver les résultats électoraux observés dans la commune.",
    scene: "calibration",
  },
  {
    nav: "L’événement",
    label: "LA RENCONTRE AVEC L’ACTUALITÉ",
    title: "Relier une nouvelle aux profils concernés",
    description: "Pour chaque événement, le système suggère des sous-populations et les retrouve dans la population de référence enrichie.",
    scene: "event",
  },
  {
    nav: "Le nouvel équilibre",
    label: "LE RÉSULTAT",
    title: "Observer le déplacement des intentions",
    description: "Le vecteur de chaque personne concernée est ajusté. L’agrégation de ces changements donne une estimation de l’effet sur les candidats.",
    scene: "impact",
  },
] as const;

const people = Array.from({ length: 36 }, (_, index) => index);
const candidateColors = pollCandidates.slice(0, 5).map((candidate) => candidate.color);

function DataFlow({ className = "" }: { className?: string }) {
  return <div className={`method-data-flow ${className}`} aria-hidden="true"><span /><span /><span /></div>;
}

function PopulationDots({ highlighted = false }: { highlighted?: boolean }) {
  return <div className={`method-people ${highlighted ? "is-targeted" : ""}`} aria-hidden="true">
    {people.map((person) => <i className={highlighted && person % 6 === 1 ? "is-highlighted" : ""} key={person} style={{ "--person-index": person } as CSSProperties} />)}
  </div>;
}

function MethodScene({ stage, playing }: { stage: (typeof stages)[number]; playing: boolean }) {
  const event = radarEvents.find((item) => item.id === "vat");
  const group = event?.impact.groups[0];

  if (stage.scene === "sources") return <div className="method-scene method-scene-sources">
    <div className="method-scene-caption"><span>DEUX SOURCES, UNE POPULATION</span><span>DONNÉES DE DÉMONSTRATION</span></div>
    <div className="method-source-layout">
      <div className="method-input-stack">
        <motion.div className="method-source-slip" animate={playing ? { x: [0, 8, 0] } : false} transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}>
          <UsersRound size={20} /><div><b>Population synthétique</b><small>Des profils représentatifs de la France</small></div>
        </motion.div>
        <motion.div className="method-source-slip method-source-polls" animate={playing ? { x: [0, 8, 0] } : false} transition={{ duration: 2.4, delay: .45, ease: "easeInOut", repeat: Infinity }}>
          <BarChart3 size={20} /><div><b>Intentions de vote passées</b><small>Les réponses observées dans les enquêtes</small></div>
        </motion.div>
      </div>
      <DataFlow />
      <div className="method-population-result"><PopulationDots /><div><b>Profils individuels</b><small>Une base enrichie, prête à être modélisée</small></div></div>
    </div>
    <motion.div className="method-flying-record" aria-hidden="true" animate={playing ? { x: [0, 188], opacity: [0, 1, 0] } : false} transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}><i /><i /><i /></motion.div>
  </div>;

  if (stage.scene === "model") return <div className="method-scene method-scene-model">
    <div className="method-scene-caption"><span>APPRENDRE, PUIS APPLIQUER AUX PROFILS</span><span>UN VECTEUR PAR PERSONNE</span></div>
    <div className="method-model-layout">
      <div className="method-poll-archive"><span className="method-mini-kicker">HISTORIQUE DES INTENTIONS</span><div className="method-mini-chart"><i /><i /><i /><i /></div><small>Résultats de vote déclarés dans les enquêtes</small></div>
      <DataFlow />
      <motion.div className="method-model-core" animate={playing ? { scale: [1, 1.04, 1] } : false} transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}><BrainCircuit size={30} /><b>Modèle</b><small>appris sur les intentions passées</small><div className="method-neuron-links"><i /><i /><i /><i /></div></motion.div>
      <DataFlow />
      <div className="method-profile-vector"><span className="method-mini-kicker">UN PROFIL SYNTHÉTIQUE</span><b>Vecteur d’intentions</b><div className="method-probabilities">{candidateColors.map((color, index) => <motion.i key={color} style={{ backgroundColor: color }} animate={playing ? { opacity: [.35, .95, .35], scale: [1, 1.2, 1] } : false} transition={{ duration: 1.8, delay: index * .16, repeat: Infinity }} />)}<small>[ p₁ · p₂ · … · pₙ ]</small></div><small>Probabilité de vote pour chaque candidat</small></div>
    </div>
  </div>;

  if (stage.scene === "calibration") return <div className="method-scene method-scene-calibration">
    <div className="method-scene-caption"><span>DU PROFIL À LA COMMUNE</span><span>CALAGE SCHÉMATIQUE · SANS ÉCHELLE</span></div>
    <div className="method-calibration-layout">
      <div className="method-calibration-input"><span className="method-mini-kicker">INTENTIONS ESTIMÉES</span><PopulationDots /><small>Probabilités de vote, profil par profil</small></div>
      <div className="method-calibration-machine"><MapPinned size={26} /><b>Calage communal</b><small>Notre algorithme ajuste les probabilités</small><DataFlow /></div>
      <div className="method-calibration-output"><span className="method-mini-kicker">RÉSULTATS LOCAUX OBSERVÉS</span><div className="method-local-bars">{pollCandidates.slice(0, 5).map((candidate, index) => <div key={candidate.id}><span>{candidate.short}</span><div><motion.i style={{ backgroundColor: candidate.color, transformOrigin: "left" }} animate={playing ? { scaleX: [.38 + index * .07, .88 - index * .09] } : false} transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatType: "reverse", delay: index * .12 }} /></div></div>)}</div><small>Les probabilités s’alignent sur le vote de la commune</small></div>
    </div>
    <div className="method-calibration-note"><span /> Les formes animées illustrent le calage; elles ne représentent pas des résultats chiffrés.</div>
  </div>;

  if (stage.scene === "event") return <div className="method-scene method-scene-event">
    <div className="method-scene-caption"><span>UN FAIT D’ACTUALITÉ, DES PROFILS CIBLÉS</span><span>EXEMPLE SIMULÉ</span></div>
    <div className="method-event-layout">
      <motion.article className="method-news-cutting" animate={playing ? { y: [4, 0, 4], rotate: [-.5, 0, -.5] } : false} transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}>
        <span><Newspaper size={13} /> ACTUALITÉ · BUDGET</span><b>{event?.title ?? "La hausse de TVA et ses effets"}</b><small>Le sujet devient un signal à confronter aux profils de la population.</small>
      </motion.article>
      <DataFlow />
      <div className="method-event-target"><span className="method-mini-kicker">SOUS-POPULATION SUGGÉRÉE</span><PopulationDots highlighted /><b>{group?.name ?? "Profils concernés"}</b><small>Le groupe est retrouvé dans la population enrichie</small></div>
    </div>
    <motion.div className="method-target-beam" aria-hidden="true" animate={playing ? { scaleX: [0, 1, 1, 0], opacity: [0, 1, 1, 0] } : false} transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }} />
    <span className="method-target-share">{group?.pct ?? "—"}<small>du groupe · exemple fictif</small></span>
  </div>;

  return <div className="method-scene method-scene-impact">
    <div className="method-scene-caption"><span>LE VECTEUR CHANGE, PUIS ON AGRÈGE</span><span>EXEMPLE SIMULÉ · PAS UN SONDAGE</span></div>
    <div className="method-impact-layout">
      <div className="method-person-vector"><span className="method-mini-kicker">POUR CHAQUE PERSONNE</span><div className="method-vector-formula"><b>vᵢ</b><span>=</span><span>[ p₁ · p₂ · … · pₙ ]</span></div><small>Ses probabilités de vote avant l’événement</small></div>
      <motion.div className="method-vector-transform"><ArrowRight size={20} /><span>Δ événement</span></motion.div>
      <div className="method-person-vector is-updated"><span className="method-mini-kicker">APRÈS L’ÉVÉNEMENT</span><div className="method-vector-formula"><b>vᵢ′</b><span>=</span><span>[ p₁+Δ₁ · … · pₙ+Δₙ ]</span></div><small>Un vecteur ajusté pour chaque profil concerné</small></div>
      <div className="method-impact-result"><span className="method-mini-kicker">EFFET AGRÉGÉ · DÉMO</span><b>{event?.impact.voteEffect ?? "Variation estimée"}</b><small>{group?.name ?? "Groupe concerné"} · {group?.flow ?? "transition simulée"}</small><strong>Ces variations fictives ne sont pas des mesures réelles.</strong></div>
    </div>
  </div>;
}

export function MethodExplainer() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [activeStage, setActiveStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);

  const stopPlayback = useCallback(() => setIsPlaying(false), []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduceMotion !== false) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAutoPlayed) {
        setHasAutoPlayed(true);
        setIsPlaying(true);
      }
      if (!entry.isIntersecting) setIsPlaying(false);
    }, { threshold: 0.25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, [hasAutoPlayed, reduceMotion]);

  useEffect(() => {
    if (!isPlaying) return;
    if (activeStage >= stages.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveStage((current) => Math.min(current + 1, stages.length - 1));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [activeStage, isPlaying]);

  const playFromBeginning = () => {
    if (activeStage === stages.length - 1) setActiveStage(0);
    setIsPlaying(true);
  };

  const goToNextStage = () => {
    setActiveStage((current) => current === stages.length - 1 ? 0 : current + 1);
  };

  const stage = stages[activeStage];

  return <section className="method-section" id="method" ref={sectionRef} aria-labelledby="method-title">
    <header className="method-heading">
      <div><span className="method-kicker"><i /> LA MÉTHODE</span><h2 id="method-title">Comment ça <em>marche&nbsp;?</em></h2></div>
      <p>Suivez le parcours des données : des profils de la population jusqu’à l’évolution estimée des intentions de vote après un événement.</p>
    </header>

    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
    <div className="method-player">
      <nav className="method-timeline" aria-label="Étapes du pipeline">
        {stages.map((item, index) => <button className={index === activeStage ? "is-active" : index < activeStage ? "is-complete" : ""} type="button" key={item.nav} aria-current={index === activeStage ? "step" : undefined} onClick={() => { stopPlayback(); setActiveStage(index); }}>
          <i aria-hidden="true" /><span>{item.nav}</span>
        </button>)}
      </nav>

      <div className="method-frame">
        <div className="method-story" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`copy-${activeStage}`} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : .24, ease: "easeOut" }}>
              <span className="method-story-label">{stage.label}</span>
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
            </motion.div>
          </AnimatePresence>

        <div className="method-controls">
            {reduceMotion ? <button type="button" className="method-play-button" onClick={goToNextStage}><ArrowRight size={15} /> Étape suivante</button> : <button type="button" className="method-play-button" onClick={isPlaying ? stopPlayback : playFromBeginning}>{isPlaying ? <><Pause size={14} /> Mettre en pause</> : activeStage === stages.length - 1 ? <><RotateCcw size={14} /> Rejouer l’animation</> : <><Play size={14} /> {hasAutoPlayed ? "Continuer l’animation" : "Lancer l’animation"}</>}</button>}
        </div>
        </div>

        <div className={`method-canvas ${isPlaying ? "is-playing" : ""}`} role="group" aria-label={`Illustration : ${stage.title}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`scene-${activeStage}`} className="method-scene-positioner" initial={reduceMotion ? false : { opacity: 0, x: 26, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, x: -12, scale: .99 }} transition={{ duration: reduceMotion ? 0 : .32, ease: [.22, 1, .36, 1] }}>
              <MethodScene stage={stage} playing={isPlaying} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
    </MotionConfig>

    <p className="method-caveat">Les exemples et chiffres qui accompagnent cette démonstration sont fictifs. Ils servent à expliquer le pipeline, pas à décrire des effets électoraux établis.</p>
  </section>;
}
