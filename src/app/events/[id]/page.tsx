import { notFound } from "next/navigation";
import { EventArticle } from "../../../components/events/EventArticle";
import { loadAnalysis } from "../../../lib/radar/loadAnalysis";
import { radarEvents } from "../../../data/radarData";

export const dynamicParams = false;

export function generateStaticParams() {
  return radarEvents.map((event) => ({ id: event.id }));
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = radarEvents.find((candidate) => candidate.id === id);
  if (!event) notFound();
  return <EventArticle event={event} analysis={loadAnalysis(id)} />;
}
