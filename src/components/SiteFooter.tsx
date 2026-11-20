import Link from "next/link";
import "./site-footer.css";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <strong>L’Observatoire</strong>
          <p>Les faits, les sondages et les hypothèses.</p>
        </div>
        <nav aria-label="Pied de page">
          <Link href="/radar">Le radar</Link>
          <Link href="/events">Événements</Link>
          <Link href="/candidates">Candidats</Link>
          <Link href="/method">Comment ça marche</Link>
          <Link href="/about">À propos et corrections</Link>
        </nav>
      </div>
    </footer>
  );
}
