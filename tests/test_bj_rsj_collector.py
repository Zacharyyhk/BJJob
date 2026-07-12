import importlib.util
import io
import pathlib
import unittest

from openpyxl import Workbook


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "collect_bj_rsj.py"
SPEC = importlib.util.spec_from_file_location("collector", SCRIPT)
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)

OTHER_SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "collect_other_sources.py"
OTHER_SPEC = importlib.util.spec_from_file_location("other_collector", OTHER_SCRIPT)
other_collector = importlib.util.module_from_spec(OTHER_SPEC)
OTHER_SPEC.loader.exec_module(other_collector)


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

    def test_mohrss_cookie_challenge(self):
        html = ("EO_Bot_Ssid WTKkN:2994459411,bOYDu:43269009,"
                "wyeCN:1143439771 (t,3612672000)")
        self.assertEqual(other_collector.mohrss_challenge_cookies(html), {
            "__tst_status": "4181168191#",
            "EO_Bot_Ssid": "3612672000",
        })

    def test_other_workbook_does_not_treat_responsibilities_as_title(self):
        self.assertEqual(other_collector.canonical_workbook_field("岗位名称"), "title")
        self.assertEqual(other_collector.canonical_workbook_field("岗位职责"), "responsibilities")
        self.assertIsNone(other_collector.canonical_workbook_field("专业工作经历"))

    def test_other_workbook_preserves_raw_fields(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "岗位表"
        sheet.append(["单位名称", "岗位名称", "学历要求", "自定义能力说明"])
        sheet.append(["测试单位", "设计岗", "硕士", "须提交作品集"])
        content = io.BytesIO()
        workbook.save(content)
        notice = {
            "source_url": "https://example.com/notice.html",
            "source_name": "测试来源",
            "category": "事业单位",
            "source_home": "https://example.com/",
            "title": "测试公告",
            "organization": "测试单位",
            "published_at": "2026-07-12",
            "deadline": "",
        }
        rows = other_collector.workbook_positions(content.getvalue(), "https://example.com/jobs.xlsx", notice)
        self.assertEqual(rows[0]["raw_fields"]["自定义能力说明"], "须提交作品集")

    def test_other_detail_preserves_deadline_sentence_for_codex(self):
        class Response:
            text = """<html><body><article><h1>招聘公告</h1>
                <p>（一）网上报名</p><p>自6月26日起至7月7日18:00，应聘人员登录报名平台。</p>
                <a href='jobs.xlsx'>附件岗位表</a></article></body></html>"""
            apparent_encoding = "utf-8"
            url = "https://example.com/notice.html"

            def raise_for_status(self):
                return None

        class Session:
            def get(self, *_args, **_kwargs):
                return Response()

        item = {"source_url": Response.url, "source_home": "https://example.com/"}
        other_collector.extract_detail(Session(), item)
        self.assertIn("自6月26日起至7月7日18:00", item["body_text"])
        self.assertNotIn("deadline", item)
        self.assertEqual(item["attachments"][0]["url"], "https://example.com/jobs.xlsx")

    def test_attachment_positions_inherit_announcement_body(self):
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["单位名称", "岗位名称", "学历要求"])
        sheet.append(["测试单位", "设计岗", "硕士"])
        content = io.BytesIO()
        workbook.save(content)
        notice = {
            "source_url": "https://example.com/notice.html",
            "source_name": "测试来源",
            "category": "中央机关单位",
            "source_home": "https://example.com/",
            "title": "测试公告",
            "organization": "测试单位",
            "published_at": "2026-06-25",
            "body_text": "自6月26日起至7月7日18:00报名。",
        }
        rows = other_collector.workbook_positions(content.getvalue(), "https://example.com/jobs.xlsx", notice)
        self.assertEqual(rows[0]["body_text"], notice["body_text"])


if __name__ == "__main__":
    unittest.main()
