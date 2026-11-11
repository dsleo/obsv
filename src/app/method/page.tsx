import type { Metadata } from "next";
import { NewsMasthead } from "../../components/events/NewsMasthead";
import { MethodExplainer } from "../../components/radar/MethodExplainer";
import { pageMetadata } from "../../lib/metadata";
import "../../components/events/event-pages.css";

export const metadata: Metadata = pageMetadata("Comment ça marche ?", "Du réel aux hypothèses : suivre une information, les personnes qu’elle concerne et ce qu’elle pourrait changer dans leurs choix.");

export default function MethodPage() {
  return (
    <main className="news-page">
      <NewsMasthead section="MÉTHODE" />
      <MethodExplainer />
    </main>
  );
}
