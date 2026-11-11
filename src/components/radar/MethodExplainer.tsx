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
    eyebrow: "LA MISE À L’ÉPREUVE",
    title: "Comparer deux situations pour chaque profil.",
    text: "Pour chaque groupe concerné, on tire au sort des profils synthétiques. Un modèle de langage se met à la place de chacun — son âge, son métier, sa commune, son histoire — et produit deux intentions : comme si l’événement n’avait pas eu lieu, puis après l’avoir appris. L’écart entre les deux réponses mesure la réaction. On répète l’exercice plusieurs fois pour étudier sa stabilité. Les effets chiffrés restent non publiés tant que la méthode n’est pas validée. Aucune personne réelle n’est interrogée.",
    image: "enquetes.webp",
    alt: "Illustration dessinée de deux personnes examinant des feuilles d’enquête à une table de travail.",
    caption: "Deux réponses par profil : avant, puis après l’événement.",
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

function StoryArtwork({
  chapter,
  index,
  active = true,
  mobile = false,
}: {
  chapter: Chapter;
  index: number;
  active?: boolean;
  mobile?: boolean;
}) {
  return (
    <figure
      className={`method-artwork ${mobile ? "method-artwork-mobile" : active ? "is-active" : ""}`}
      aria-hidden={!mobile && !active ? true : undefined}
    >
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/method/${chapter.image}`}
        alt={chapter.alt}
        loading={index > 0 ? "lazy" : "eager"}
      />
      <figcaption>
        <strong>{chapter.caption}</strong>
      </figcaption>
    </figure>
  );
}

export function MethodExplainer() {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const nodes = chapterRefs.current.filter((node): node is HTMLElement => node !== null);
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const index = nodes.indexOf(visible.target as HTMLElement);
          if (index >= 0) setActiveChapter(index);
        }
      },
      { rootMargin: "-26% 0px -44% 0px", threshold: [0, 0.15, 0.35, 0.6] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="method-section" id="method" aria-labelledby="method-title">
      <header className="method-heading">
        <div className="method-heading-main">
          <h1 id="method-title">
            Comment ça <em>marche&nbsp;?</em>
          </h1>
        </div>
      </header>

      <div className="method-story-layout">
        <div className="method-chapters">
          {chapters.map((chapter, index) => (
            <article
              className={`method-chapter ${activeChapter === index ? "is-current" : ""}`}
              key={chapter.title}
              ref={(node) => {
                chapterRefs.current[index] = node;
              }}
            >
              <div className="method-chapter-copy">
                <span className="method-story-label">{chapter.eyebrow}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.text}</p>
              </div>
              <StoryArtwork chapter={chapter} index={index} mobile />
            </article>
          ))}
        </div>

        <section
          className="method-sticky-visual"
          aria-label="Illustrations du fonctionnement du modèle"
        >
          <div className="method-visual-masthead">DU FAIT AU SCÉNARIO</div>
          <div className="method-visual-window">
            {chapters.map((chapter, index) => (
              <StoryArtwork
                key={chapter.title}
                chapter={chapter}
                index={index}
                active={index === activeChapter}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="method-essential method-essential-bottom">
        <p>
          <strong>Les sondages sont des observations.</strong> Ils proviennent de Sondax, d’après
          Wikipédia. Les points du graphique correspondent à la fin du terrain ; les courbes
          décrivent une moyenne lissée. Chaque observation renvoie à sa source.
        </p>
        <p>
          <strong>Les hypothèses sont des simulations.</strong> Un modèle de langage répond à partir
          de profils synthétiques. Aucune personne réelle n’est interrogée. Les pourcentages
          décrivent les réponses simulées, sans mesurer une part des électeurs.
        </p>
        <details>
          <summary>Ce que l’on ne peut pas en conclure</summary>
          <p>
            Un mouvement dans les sondages ne peut pas être attribué à un événement à partir de ces
            graphiques. La capacité du modèle à prévoir des effets spécifiques reste à établir. Les
            groupes sont exploratoires, parfois superposés, et ne forment pas un échantillon
            représentatif de l’électorat. Une simulation stable peut néanmoins être erronée.
          </p>
        </details>
        <details>
          <summary>Sondages, sources et calcul de la moyenne</summary>
          <p>
            Source : <a href="https://sondax.fr">Sondax</a>, d’après Wikipédia, CC BY-SA 4.0. Nous
            retenons la configuration principale au premier tour, avec une taille d’échantillon
            renseignée. Le lissage utilise une pondération gaussienne autour de chaque date
            (écart-type d’environ 4,5 jours), sans pondération par la taille d’échantillon. Les
            configurations testées et les instituts varient ; la moyenne n’est ni une prévision ni
            une mesure d’effet causal. Les absences de données ne valent pas zéro.
          </p>
          <p>
            Les instituts, périodes de terrain, tailles d’échantillon et notices sont accessibles
            depuis les liens Sondax. Les graphiques affichent les observations publiées ; les
            courbes servent uniquement à en rendre l’évolution lisible.
          </p>
        </details>
      </div>
    </section>
  );
}
