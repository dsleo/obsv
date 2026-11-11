import { pageMetadata } from "../../lib/metadata";
import { CandidatesIndex } from "../../components/candidates/CandidatesIndex";

export const metadata = pageMetadata(
  "Candidats et sondages",
  "Comparer les personnalités testées dans les sondages, consulter les dates des terrains et les sources.",
);

export default function CandidatesPage() {
  return <CandidatesIndex />;
}
