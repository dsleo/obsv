import { PollingExplorer } from "../polls/PollingExplorer";
import type { CandidateId } from "../../data/chartData";
export function CandidateChart({ candidateId, eventIds }: { candidateId: CandidateId; color?: string; eventIds?: string[] }) {
  return <PollingExplorer candidateId={candidateId} eventIds={eventIds} />;
}
