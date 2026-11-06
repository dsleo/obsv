import Link from "next/link";
import "./demo-banner.css";

export function DemoBanner() {
  return (
    <section className="demo-banner" aria-label="Statut des données">
      <strong>Sondages réels, événements simulés</strong>
      <span>Les intentions de vote proviennent des sondages publiés (Sondax, d’après Wikipédia). Les événements et leurs effets restent simulés : ils ne mesurent aucune réaction réelle.</span>
      <Link href="/#method">Voir la méthode</Link>
    </section>
  );
}
