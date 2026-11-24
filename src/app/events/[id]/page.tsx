import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventArticle } from "../../../components/events/EventArticle";
import { loadAnalysis } from "../../../lib/radar/loadAnalysis";
import { pageMetadata } from "../../../lib/metadata";
import { publishedEvents } from "../../../lib/radar/publishedEvents";

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedEvents.map((event) => ({ id: event.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const event = publishedEvents.find((candidate) => candidate.id === id);
  return event ? pageMetadata(event.title, event.summary, "article") : {};
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = publishedEvents.find((candidate) => candidate.id === id);
  if (!event) notFound();
  const analysis = loadAnalysis(id);
  if (!analysis) notFound();
  return <EventArticle event={event} analysis={analysis} />;
}
