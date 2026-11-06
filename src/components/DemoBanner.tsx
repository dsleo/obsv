import Link from "next/link";
import "./demo-banner.css";

export function DemoBanner() {
  return (
    <section className="demo-banner" aria-label="Données de démonstration">
      <strong>Données de démonstration</strong>
      <span>Sondages, événements et effets sont simulés : ils ne mesurent aucune intention de vote réelle.</span>
      <Link href="/#method">Voir la méthode</Link>
    </section>
  );
}
