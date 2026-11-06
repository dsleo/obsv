import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CandidateDetail } from "../../../components/candidates/CandidateDetail";
import { pageMetadata } from "../../../lib/metadata";
import { pollCandidates } from "../../../data/radarData";

export const dynamicParams = false;

export function generateStaticParams() {
  return pollCandidates.map((candidate) => ({ id: candidate.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const candidate = pollCandidates.find((entry) => entry.id === id);
  return candidate ? pageMetadata(candidate.name, `Intentions de vote et évolution pour  (), données de démonstration.`) : {};
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!pollCandidates.some((candidate) => candidate.id === id)) notFound();
  return <CandidateDetail candidateId={id} />;
}
