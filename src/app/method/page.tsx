import type { Metadata } from "next";
import { NewsMasthead } from "../../components/events/NewsMasthead";
import { MethodExplainer } from "../../components/radar/MethodExplainer";
import { pageMetadata } from "../../lib/metadata";
import "../../components/events/event-pages.css";

export const metadata: Metadata = pageMetadata(
  "Comment ça marche ?",
  "Comprendre les sondages, les sources et la construction des scénarios de l’Observatoire.",
);

export default function MethodPage() {
  return (
    <main className="news-page" id="contenu">
      <NewsMasthead section="MÉTHODE" />
      <MethodExplainer />
    </main>
  );
}
