import Link from "next/link";
import { BrandMark } from "../BrandMark";

export function NewsMasthead({ section }: { section: string }) {
  return (
    <>
      <header className="news-masthead">
        <Link href="/" className="news-brand" aria-label="L’Observatoire, accueil">
          <span className="news-brand-mark"><BrandMark /></span>
          <span>L’Observatoire</span>
        </Link>

        <nav className="news-nav" aria-label="Rubriques">
          <Link href="/" className={section === "ACCUEIL" ? "active" : undefined} aria-current={section === "ACCUEIL" ? "page" : undefined}>Le radar</Link>
          <Link href="/events" className={section === "ÉVÉNEMENTS" || section === "ÉVÉNEMENT" ? "active" : undefined} aria-current={section === "ÉVÉNEMENTS" ? "page" : undefined}>Événements</Link>
          <Link href="/candidates" className={section === "CANDIDATS" ? "active" : undefined} aria-current={section === "CANDIDATS" ? "page" : undefined}>Candidats</Link>
        </nav>

      </header>
    </>
  );
}
