import json
import tempfile
import unittest
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from scripts.radar.import_elections import import_data


class ElectionImportTest(unittest.TestCase):
    def test_multi_choice_municipal_ballot_keeps_turnout_without_fake_vote_simplex(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            general = root / "general.parquet"
            candidates = root / "candidates.parquet"
            pq.write_table(pa.Table.from_pylist([{
                "id_election": "2020_muni_t1", "id_brut_miom": "01001_0001",
                "code_commune": "01001", "libelle_commune": "Abergement",
                "code_departement": "01", "inscrits": 10, "abstentions": 2,
                "blancs": 0, "nuls": 0, "exprimes": 8,
            }]), general)
            pq.write_table(pa.Table.from_pylist([{
                "id_election": "2020_muni_t1", "id_brut_miom": "01001_0001",
                "code_commune": "01001", "no_panneau": number, "voix": 6,
                "nuance": None, "nom": name, "prenom": "", "liste": "",
                "libelle_abrege_liste": "", "libelle_etendu_liste": "",
                "nom_tete_liste": "",
            } for number, name in [(1, "Alice"), (2, "Bob")]]), candidates)
            output = root / "out"
            import_data(general, candidates, output, {"2020_muni_t1"})
            cell = json.loads((output / "2020_muni_t1.jsonl").read_text().strip())
            self.assertFalse(cell["voteVectorEligible"])
            self.assertEqual(cell["counts"], {"abstention": 2, "blank_null": 0, "expressed": 8})
            self.assertEqual(sum(cell["rawCandidateTallies"].values()), 12)


if __name__ == "__main__":
    unittest.main()
