import json
import tempfile
import unittest
from pathlib import Path

from attach_history import attach


class AttachHistoryTest(unittest.TestCase):
    def test_parent_commune_fallback_and_unmatched_row(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            index = root / "personas.jsonl"
            rows = [
                {"id": "paris", "geography": {"communeCode": "75101", "parentCommuneCode": "75056"}},
                {"id": "missing", "geography": {"communeCode": "99999"}},
            ]
            index.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf8")
            Path(str(index) + ".manifest.json").write_text(json.dumps({"frame": "distributed_pages"}), encoding="utf8")
            margin = root / "2022_pres_t1.jsonl"
            margin.write_text(json.dumps({
                "electionId": "2022_pres_t1", "communeCode": "75056", "registered": 10,
                "counts": {"abstention": 2, "blank_null": 1, "choice_7": 7},
                "choices": {"choice_7": {"label": "Candidate A"}},
            }) + "\n", encoding="utf8")

            report = attach(index, [margin])
            attached = [json.loads(line) for line in index.read_text(encoding="utf8").splitlines()]

            self.assertEqual(report["matchedRowsByElection"]["2022_pres_t1"], 1)
            self.assertEqual(attached[0]["historicalContext"][0]["scope"], "observed_parent_commune_context")
            self.assertEqual(attached[0]["historicalContext"][0]["choices"][0]["shareOfRegistered"], 0.7)
            self.assertEqual(attached[1]["historicalContext"], [])
            self.assertNotIn("historicalPropensity", attached[0])


if __name__ == "__main__":
    unittest.main()
