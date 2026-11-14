import Link from "next/link";
import { BrandMark } from "../BrandMark";

export function RadarHeader({ active }: { active: "home" | "radar" }) {
  const cur = (k: string) => (k === active ? { className: "active", "aria-current": "page" as const } : {});
  return (
    <header className="radar-header">
      <Link className="radar-brand" href="/" aria-label="L’Observatoire, accueil">
        <span className="radar-brand-mark">
          <BrandMark />
        </span>
        <span>L’Observatoire</span>
      </Link>
      <nav className="radar-nav" aria-label="Navigation principale">
        <Link {...cur("radar")} href="/radar">Le radar</Link>
        <Link href="/events">Événements</Link>
        <Link href="/candidates">Candidats</Link>
        <Link href="/method">Méthode</Link>
      </nav>
    </header>
  );
}
