import { notFound } from "next/navigation";
import { CandidateDetail } from "../../../components/candidates/CandidateDetail";
import { pollCandidates } from "../../../data/radarData";

export const dynamicParams = false;

export function generateStaticParams() {
  return pollCandidates.map((candidate) => ({ id: candidate.id }));
}

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!pollCandidates.some((candidate) => candidate.id === id)) notFound();
  return <CandidateDetail candidateId={id} />;
}
