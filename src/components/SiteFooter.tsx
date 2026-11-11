import Link from "next/link";
import "./site-footer.css";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <strong>L’Observatoire</strong>
          <p>Quand l’actualité bouge, qui bascule ?</p>
        </div>
        <nav aria-label="Pied de page">
          <Link href="/">Le radar</Link>
          <Link href="/events">Événements</Link>
          <Link href="/candidates">Candidats</Link>
          <Link href="/method">Méthode</Link>
        </nav>
      </div>
    </footer>
  );
}
