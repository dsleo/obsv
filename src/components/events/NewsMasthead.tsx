import Link from "next/link";
import { Orbit } from "lucide-react";

export function NewsMasthead({ section }: { section: string }) {
  return (
    <>
      <header className="news-masthead">
        <Link href="/" className="news-brand" aria-label="L’Observatoire, accueil">
          <span className="news-brand-mark"><Orbit size={19} strokeWidth={1.7} /></span>
          <span>L’OBSERVATOIRE</span>
        </Link>

        <nav className="news-nav" aria-label="Rubriques">
          <Link href="/">Le radar</Link>
          <Link href="/events" className={section === "ÉVÉNEMENTS" || section === "ÉVÉNEMENT" ? "active" : undefined}>Événements</Link>
        </nav>

        <div className="news-masthead-actions">
          <Link href="/candidates" className={`candidate-shortcut ${section === "CANDIDATS" ? "active" : ""}`}>Candidats</Link>
          <span className="news-masthead-meta"><span className="news-live-dot" /> MODÈLE ACTIF <b>20 OCT. 2026</b></span>
        </div>
      </header>
      <div className="news-section-rule">
        <span>{section}</span>
      </div>
    </>
  );
}
