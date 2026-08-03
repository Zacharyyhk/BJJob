import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "collect_other_sources", ROOT / "scripts" / "collect_other_sources.py"
)
assert SPEC is not None and SPEC.loader is not None
COLLECTOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COLLECTOR)


class FakeResponse:
    def __init__(self, payload, url="https://example.test/api", status_code=200):
        self.payload = payload
        self.url = url
        self.status_code = status_code
        self.ok = 200 <= status_code < 400
        self.headers = {"Content-Type": "application/json"}

    def json(self):
        return self.payload

    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeSigner:
    def __init__(self):
        self.calls = []

    def sign(self, url, body=None):
        self.calls.append((url, body))
        return "test-signature"


class AtsSession:
    def __init__(self):
        self.requests = []

    def post(self, url, **kwargs):
        self.requests.append(("POST-CSRF", url, kwargs))
        return FakeResponse({"code": 0, "data": {"token": "csrf-token"}}, url)

    def request(self, method, url, **kwargs):
        self.requests.append((method, url, kwargs))
        if "/config/job/filters/" in url:
            return FakeResponse({"code": 0, "data": {"recruitment_type_list": []}}, url)
        body = json.loads(kwargs["data"])
        self.search_body = body
        return FakeResponse({
            "code": 0,
            "data": {
                "count": 1,
                "job_post_list": [{
                    "id": "job-1",
                    "title": "产品体验设计",
                    "description": "负责交互与视觉体验设计。",
                    "requirement": "2027届，设计学相关专业。",
                    "publish_time": 1785000000000,
                    "recruit_type": {
                        "id": "201",
                        "name": "正式",
                        "parent": {"id": "2", "name": "校招"},
                    },
                    "city_info": {"code": "CT_11", "name": "北京"},
                }],
            },
        }, url)


class MeituanSession:
    def post(self, url, **kwargs):
        self.body = json.loads(kwargs["data"])
        return FakeResponse({
            "status": 1,
            "data": {
                "page": {"totalPage": 1},
                "list": [{
                    "jobUnionId": "mt-1",
                    "name": "视觉设计师",
                    "jobType": "1",
                    "cityList": [{"name": "北京市"}],
                    "jobDuty": "负责品牌视觉设计。",
                    "jobRequirement": "设计相关专业。",
                    "refreshTime": 1785000000000,
                }],
            },
        }, url)


class TencentSession:
    def get(self, url, **kwargs):
        if "getProjectMapping" in url:
            return FakeResponse({
                "status": 0,
                "data": [{
                    "id": 1,
                    "recruitType": 1,
                    "subProjectList": [{
                        "mappingId": 1,
                        "projectName": "校园招聘",
                    }],
                }],
            }, url)
        return FakeResponse({
            "status": 0,
            "data": {
                "postId": "tx-1",
                "title": "产品体验设计",
                "desc": "负责用户研究、交互和视觉设计。",
                "request": "设计学相关专业。",
                "workCityList": ["北京"],
                "projectId": 1,
                "recruitType": 1,
            },
        }, url)

    def post(self, url, **kwargs):
        self.body = json.loads(kwargs["data"])
        return FakeResponse({
            "status": 0,
            "data": {
                "count": 1,
                "positionList": [{
                    "postId": "tx-1",
                    "positionTitle": "产品体验设计",
                    "projectId": 1,
                    "workCities": "北京",
                }],
            },
        }, url)


class PddSession:
    def __init__(self):
        self.list_bodies = []
        self.detail_bodies = []

    def post(self, url, **kwargs):
        body = json.loads(kwargs["data"])
        if url.endswith("/position/list"):
            self.list_bodies.append(body)
            return FakeResponse({
                "success": True,
                "result": {
                    "total": "2",
                    "list": [
                        {
                            "id": "pdd-bj-1",
                            "name": "用户运营管培生（北京）",
                            "workLocationName": "北京",
                            "graduationYear": "2027",
                            "releaseTime": 1785000000000,
                            "jobDuty": "负责用户研究与运营策略。",
                        },
                        {
                            "id": "pdd-sh-1",
                            "name": "运营管培生（上海）",
                            "workLocationName": "上海",
                            "graduationYear": "2027",
                            "releaseTime": 1785000000000,
                        },
                    ],
                },
            }, url)
        self.detail_bodies.append(body)
        return FakeResponse({
            "success": True,
            "result": {
                "id": "pdd-bj-1",
                "name": "用户运营管培生（北京）",
                "workLocationName": "北京",
                "graduationYear": "2027",
                "releaseTime": 1785000000000,
                "jobDuty": "负责用户研究与运营策略。",
                "serveRequirement": "2027届本科及以上，专业不限。",
            },
        }, url)


class FormalCampusAdapterTests(unittest.TestCase):
    def test_temporary_source_failure_retains_last_good_items(self):
        report = {
            "source_id": "example",
            "status": "adapter-blocked",
            "item_count": 0,
            "items": [],
        }
        previous = {"source_id": "example", "items": [{"id": "old-job"}]}

        result = COLLECTOR.retain_previous_items(report, previous, "2026-08-01T08:30:00+08:00")

        self.assertEqual(result["item_count"], 1)
        self.assertEqual(result["items"], [{"id": "old-job"}])
        self.assertTrue(result["retained_from_previous"])
        self.assertEqual(result["retained_snapshot_at"], "2026-08-01T08:30:00+08:00")

    def test_ats_adapter_queries_all_locations_in_formal_campus_scope(self):
        source = {
            "id": "bytedance-jobs",
            "name": "字节跳动校园招聘",
            "group": "互联网大厂",
            "url": "https://jobs.bytedance.com/campus/position",
            "ats_origin": "https://jobs.bytedance.com",
            "portal_type": 3,
            "portal_channel": "campus",
            "recruitment_id_list": ["201"],
            "organization": "字节跳动",
        }
        session = AtsSession()
        signer = FakeSigner()

        items, status, _ = COLLECTOR.ats_campus_adapter(session, source, signer)

        self.assertEqual(status, "collected")
        self.assertEqual(session.search_body["recruitment_id_list"], ["201"])
        self.assertEqual(session.search_body["location_code_list"], [])
        self.assertNotIn("subject_id_list", {
            key: value for key, value in session.search_body.items() if value
        })
        self.assertEqual(items[0]["raw_fields"]["recruit_type"]["name"], "正式")
        self.assertEqual(items[0]["location"], "北京")
        self.assertIn("2027届", items[0]["body_text"])
        self.assertGreaterEqual(len(signer.calls), 2)

    def test_meituan_adapter_uses_formal_campus_job_type(self):
        source = {
            "id": "meituan-jobs",
            "name": "美团校园招聘",
            "group": "互联网大厂",
            "url": "https://zhaopin.meituan.com/web/campus",
        }
        session = MeituanSession()

        items, status, _ = COLLECTOR.meituan_adapter(session, source)

        self.assertEqual(status, "collected")
        self.assertEqual(session.body["jobType"], [{"code": "1", "subCode": []}])
        self.assertEqual(session.body["cityList"], [])
        self.assertEqual(items[0]["raw_fields"]["jobType"], "1")
        self.assertEqual(items[0]["location"], "北京市")

    def test_tencent_adapter_excludes_intern_project_ids(self):
        source = {
            "id": "tencent-jobs",
            "name": "腾讯校园招聘",
            "group": "互联网大厂",
            "url": "https://join.qq.com/",
            "project_mapping_ids": [1, 14],
        }
        session = TencentSession()

        items, status, _ = COLLECTOR.tencent_adapter(session, source)

        self.assertEqual(status, "collected")
        self.assertEqual(session.body["projectMappingIdList"], [1, 14])
        self.assertEqual(session.body["workCityList"], [])
        self.assertEqual(items[0]["raw_fields"]["recruitType"], 1)
        self.assertIn("交互", items[0]["body_text"])
        self.assertEqual(items[0]["location"], "北京")

    def test_pdd_adapter_keeps_all_graduate_locations_and_fetches_details(self):
        source = {
            "id": "pdd-jobs",
            "name": "拼多多校园招聘",
            "group": "互联网大厂",
            "url": "https://careers.pddglobalhr.com/campus/grad",
        }
        session = PddSession()

        items, status, _ = COLLECTOR.pdd_adapter(session, source)

        self.assertEqual(status, "collected")
        self.assertEqual(session.list_bodies, [{"page": 1, "pageSize": 10}])
        self.assertEqual(session.detail_bodies, [{"id": "pdd-bj-1"}, {"id": "pdd-sh-1"}])
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["organization"], "拼多多")
        self.assertIn("专业不限", items[0]["body_text"])
        self.assertEqual(items[0]["collection_scope"]["work_location"], "北京")
        self.assertEqual(items[1]["collection_scope"]["work_location"], "上海")


if __name__ == "__main__":
    unittest.main()
