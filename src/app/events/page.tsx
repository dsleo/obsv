import { pageMetadata } from "../../lib/metadata";
import { EventsIndex } from "../../components/events/EventsIndex";

export const metadata = pageMetadata(
  "Actualités et sources",
  "Parcourir les événements de la présidentielle, rechercher une actualité et vérifier ses sources.",
);

export default function EventsPage() {
  return <EventsIndex />;
}
