import Link from "next/link";
import { BrandMark } from "../BrandMark";
import { sitePath } from "../../lib/paths";

export function NewsMasthead({ section }: { section: string }) {
  return (
    <>
      <header className="news-masthead">
        <Link href="/" className="news-brand" aria-label="L’Observatoire, accueil">
          <span className="news-brand-mark">
            <BrandMark />
          </span>
          <span>L’Observatoire</span>
        </Link>

        <nav className="news-nav" aria-label="Rubriques">
          <a
            href={sitePath("/")}
            className={section === "ACCUEIL" ? "active" : undefined}
            aria-current={section === "ACCUEIL" ? "page" : undefined}
          >
            Le radar
          </a>
          <a
            href={sitePath("/events")}
            className={section === "ÉVÉNEMENTS" || section === "ÉVÉNEMENT" ? "active" : undefined}
            aria-current={section === "ÉVÉNEMENTS" ? "page" : undefined}
          >
            Événements
          </a>
          <a
            href={sitePath("/candidates")}
            className={section === "CANDIDATS" ? "active" : undefined}
            aria-current={section === "CANDIDATS" ? "page" : undefined}
          >
            Candidats
          </a>
          <a href={sitePath("/method")} aria-current={section === "MÉTHODE" ? "page" : undefined}>
            Méthode
          </a>
        </nav>
      </header>
    </>
  );
}
