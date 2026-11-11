import Link from "next/link";
import { NewsMasthead } from "../components/events/NewsMasthead";
import "../components/events/event-pages.css";
export default function NotFound() {
  return (
    <main className="news-page" id="contenu">
      <NewsMasthead section="" />
      <div className="about-content">
        <span className="news-kicker">PAGE INTROUVABLE</span>
        <h1>Cette page n’est plus disponible.</h1>
        <p>
          Le lien peut être incomplet ou l’actualité avoir été retirée. Retrouvez les informations
          publiées dans les rubriques du site.
        </p>
        <p>
          <Link className="text-action" href="/events">
            Rechercher une actualité
          </Link>{" "}
          · <Link href="/">Revenir au radar</Link>
        </p>
      </div>
    </main>
  );
}
