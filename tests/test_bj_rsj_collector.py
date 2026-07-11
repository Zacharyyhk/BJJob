import importlib.util
import pathlib
import unittest


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "collect_bj_rsj.py"
SPEC = importlib.util.spec_from_file_location("collector", SCRIPT)
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)


class CollectorParsingTests(unittest.TestCase):
    def test_listing_is_deduplicated(self):
        html = """
        <ul><li><a href='./202607/t20260710_1.html' title='招聘公告'>招聘公告</a> 2026-07-10</li>
        <li><a href='./202607/t20260710_1.html'>招聘公告</a> 2026-07-10</li></ul>
        """
        rows = collector.parse_listing(html)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["published_at"], "2026-07-10")

    def test_application_period(self):
        text = ("2025年1月1日至2026年7月31日期间取得学位的人员可以报考。"
                "报考人员须于2026年7月15日10:00至7月21日15:00期间登录并提交应聘申请。")
        start, end = collector.extract_period(text)
        self.assertEqual(start, "2026-07-15T10:00:00+08:00")
        self.assertEqual(end, "2026-07-21T15:00:00+08:00")

    def test_header_aliases(self):
        self.assertEqual(collector.canonical_key("招聘岗位名称"), "title")
        self.assertEqual(collector.canonical_key("拟招聘人数"), "headcount")
        self.assertEqual(collector.canonical_key("专业要求"), "major")
        self.assertIsNone(collector.canonical_key("拟招聘岗位等级"))
        self.assertIsNone(collector.canonical_key("计划聘用人数与面试人选的确定比例"))


if __name__ == "__main__":
    unittest.main()
