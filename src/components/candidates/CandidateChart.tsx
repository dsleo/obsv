import { PollingExplorer } from "../polls/PollingExplorer";
import type { CandidateId } from "../../data/chartData";
export function CandidateChart({ candidateId }: { candidateId: CandidateId; color?: string }) {
  return <PollingExplorer candidateId={candidateId} />;
}
