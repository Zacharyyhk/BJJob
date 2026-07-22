import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "prepare_codex_analysis", ROOT / "scripts" / "prepare_codex_analysis.py"
)
assert SPEC is not None and SPEC.loader is not None
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)


class PositionIdTests(unittest.TestCase):
    def test_attachment_rows_with_same_sheet_and_row_get_stable_unique_ids(self):
        positions = [
            {
                "sheet": "应聘登记表",
                "row": 9,
                "source_attachment_url": "https://example.test/a.xlsx",
                "raw_fields": {"字段": "甲"},
            },
            {
                "sheet": "应聘登记表",
                "row": 9,
                "source_attachment_url": "https://example.test/b.xlsx",
                "raw_fields": {"字段": "乙"},
            },
        ]

        ids = PREPARE.position_ids("notice", positions)

        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(value.startswith("notice-应聘登记表-9-") for value in ids))
        self.assertEqual(ids, PREPARE.position_ids("notice", positions))

    def test_non_colliding_id_keeps_legacy_shape(self):
        positions = [{"sheet": "岗位表", "row": 3, "raw_fields": {"岗位": "设计"}}]

        self.assertEqual(PREPARE.position_ids("notice", positions), ["notice-岗位表-3"])


if __name__ == "__main__":
    unittest.main()
