"use client";

import { useEffect, useRef, useState } from "react";
import "./method-explainer.css";

const chapters = [
  {
    eyebrow: "LE POINT DE DÉPART",
    title: "Une France de profils, pas un électeur moyen.",
    text: "La population synthétique réunit des parcours, des lieux de vie et des situations différentes. Les enquêtes électorales passées apportent les intentions de vote observées.",
    image: "population.webp",
    alt: "Illustration dessinée de personnes de différents âges et horizons dans une rue française, devant un bureau de vote.",
    caption: "Une population plurielle sert de terrain d’étude.",
  },
  {
    eyebrow: "APPRENDRE DES ENQUÊTES",
    title: "Un modèle relie profils et intentions de vote.",
    text: "On entraîne le modèle avec les enquêtes passées. Il apprend les liens entre les caractéristiques des personnes — âge, activité, lieu de vie — et leurs intentions de vote. Il prédit ensuite une probabilité par candidat pour chaque profil synthétique.",
    image: "enquetes.webp",
    alt: "Illustration dessinée de deux personnes examinant des feuilles d’enquête à une table de travail.",
    caption: "Des caractéristiques au vote probable, jamais certain.",
  },
  {
    eyebrow: "LE CALAGE LOCAL",
    title: "Un algorithme adapte le modèle à chaque commune.",
    text: "Un algorithme recale ces probabilités à partir des résultats électoraux observés localement. Il adapte les prévisions du modèle pour retrouver le vote de chaque commune et donner aux estimations un ancrage territorial.",
    image: "commune.webp",
    alt: "Vue dessinée d’une commune française entre centre-ville, quartiers résidentiels et campagne.",
    caption: "Les résultats locaux recalibrent les estimations.",
  },
  {
    eyebrow: "L’ACTUALITÉ ENTRE EN SCÈNE",
    title: "Une même nouvelle ne touche pas tout le monde pareil.",
    text: "Face à un événement, le système suggère les groupes qui pourraient être concernés. Une hausse de TVA, par exemple, résonne différemment selon le budget et le quotidien de chacun.",
    image: "actualite.webp",
    alt: "Illustration dessinée de lecteurs dans un café, avec un journal sur la hausse des prix et un ticket de caisse.",
    caption: "L’événement rencontre des vies différentes.",
  },
  {
    eyebrow: "LE SCÉNARIO FINAL",
    title: "Des réactions individuelles à un effet possible.",
    text: "Le modèle fait évoluer les probabilités des profils concernés, puis les rassemble pour estimer ce que cela pourrait changer pour les candidats. Ce résultat est un scénario, distinct d’un sondage.",
    image: "candidats.webp",
    alt: "Illustration dessinée de citoyens face à six pupitres de candidats, tenant des bulletins sans inscription.",
    caption: "Un déplacement estimé, jamais un résultat mesuré.",
  },
] as const;

type Chapter = (typeof chapters)[number];

function StoryArtwork({ chapter, index, active = true, mobile = false }: { chapter: Chapter; index: number; active?: boolean; mobile?: boolean }) {
  return <figure className={`method-artwork ${mobile ? "method-artwork-mobile" : active ? "is-active" : ""}`} aria-hidden={!mobile && !active ? true : undefined}>
    <img src={`method/${chapter.image}`} alt={chapter.alt} loading={index > 0 ? "lazy" : "eager"} />
    <figcaption><strong>{chapter.caption}</strong></figcaption>
  </figure>;
}

export function MethodExplainer() {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const nodes = chapterRefs.current.filter((node): node is HTMLElement => node !== null);
    if (!nodes.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const index = nodes.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActiveChapter(index);
      }
    }, { rootMargin: "-26% 0px -44% 0px", threshold: [0, 0.15, 0.35, 0.6] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return <section className="method-section" id="method" aria-labelledby="method-title">
      <header className="method-heading">
        <div className="method-heading-main"><h2 id="method-title">Comment ça <em>marche&nbsp;?</em></h2></div>
        <p>Du réel aux hypothèses&nbsp;: suivez une information, les personnes qu’elle concerne et ce qu’elle pourrait changer dans leurs choix.</p>
      </header>

      <div className="method-story-layout">
        <div className="method-chapters">
          {chapters.map((chapter, index) => <article className={`method-chapter ${activeChapter === index ? "is-current" : ""}`} key={chapter.image} ref={(node) => { chapterRefs.current[index] = node; }}>
            <div className="method-chapter-copy"><span className="method-story-label">{chapter.eyebrow}</span><h3>{chapter.title}</h3><p>{chapter.text}</p></div>
            <StoryArtwork chapter={chapter} index={index} mobile />
          </article>)}
        </div>

        <aside className="method-sticky-visual" aria-label="Illustrations du fonctionnement du modèle">
          <div className="method-visual-masthead">DU FAIT AU SCÉNARIO</div>
          <div className="method-visual-window">
            {chapters.map((chapter, index) => <StoryArtwork key={chapter.image} chapter={chapter} index={index} active={index === activeChapter} />)}
          </div>
        </aside>
      </div>
      <p className="method-caveat"><span>À garder en tête</span> Les exemples présentés ici sont fictifs. Le scénario illustre une méthode&nbsp;: il ne mesure pas l’effet causal d’un événement et ne remplace pas un sondage.</p>
    </section>;
}
