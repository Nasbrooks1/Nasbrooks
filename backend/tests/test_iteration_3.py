"""Iteration 3 tests: judges, daily case, objection judge-bias, portraits, highlights."""
import os
import time
import pytest
import requests
from datetime import date

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Judges on seeded cases ----------------
EXPECTED_JUDGES = {
    "case-johnson-1047": ("Hon. Marilyn Hartwell", "strict"),
    "case-vega-2101": ("Hon. Samuel Ortiz", "by-the-book"),
    "case-blackbyte-3300": ("Hon. Ruth Bergman", "tech-skeptic"),
    "case-fiction-durk-99": ("Hon. Charles Whitmore", "lenient"),
}


@pytest.mark.parametrize("case_id,expected", list(EXPECTED_JUDGES.items()))
def test_case_has_judge(api, case_id, expected):
    name, personality = expected
    r = api.get(f"{BASE_URL}/api/cases/{case_id}", timeout=15)
    assert r.status_code == 200
    j = r.json().get("judge")
    assert j is not None, f"judge missing on {case_id}"
    assert j["name"] == name
    assert j["personality"] == personality
    assert isinstance(j["tagline"], str) and j["tagline"]
    assert isinstance(j["sustain_bias"], (int, float))


def test_all_judge_personalities_distinct(api):
    personalities = set()
    for case_id in EXPECTED_JUDGES:
        r = api.get(f"{BASE_URL}/api/cases/{case_id}", timeout=15)
        personalities.add(r.json()["judge"]["personality"])
    assert personalities == {"strict", "lenient", "by-the-book", "tech-skeptic"}


# ---------------- Daily case ----------------
def test_daily_case(api):
    r = api.get(f"{BASE_URL}/api/cases/daily", timeout=15)
    assert r.status_code == 200
    c = r.json()
    today = date.today().isoformat()
    assert c["id"] == f"daily-{today}"
    assert c["is_daily"] is True
    assert c["judge"] is not None and c["judge"]["name"]
    assert len(c["witnesses"]) == 2
    assert 2 <= len(c["clues"]) <= 3
    assert len(c["evidence"]) == 3


def test_daily_case_deterministic(api):
    r1 = api.get(f"{BASE_URL}/api/cases/daily", timeout=15).json()
    r2 = api.get(f"{BASE_URL}/api/cases/daily", timeout=15).json()
    assert r1["id"] == r2["id"]
    assert r1["title"] == r2["title"]
    assert r1["judge"]["name"] == r2["judge"]["name"]


# ---------------- Objection with judge personality ----------------
def test_objection_strict_judge(api):
    payload = {
        "objection_type": "Hearsay",
        "question": "What did the informant tell you the defendant said?",
        "context": "witness is federal agent recounting third-party statement",
        "case_id": "case-johnson-1047",
    }
    r = api.post(f"{BASE_URL}/api/objection/rule", json=payload, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j["ruling"] in ("sustained", "overruled")
    assert isinstance(j["reasoning"], str) and len(j["reasoning"]) > 5


def test_objection_lenient_judge(api):
    payload = {
        "objection_type": "Relevance",
        "question": "Where were you at the time of the alleged incident?",
        "context": "defense pushback on scope",
        "case_id": "case-fiction-durk-99",
    }
    r = api.post(f"{BASE_URL}/api/objection/rule", json=payload, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j["ruling"] in ("sustained", "overruled")
    assert len(j["reasoning"]) > 5


def test_objection_no_case_id(api):
    """Backward-compat: case_id is optional."""
    payload = {
        "objection_type": "Leading",
        "question": "You saw the defendant at the scene, didn't you?",
    }
    r = api.post(f"{BASE_URL}/api/objection/rule", json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json()["ruling"] in ("sustained", "overruled")


# ---------------- Witness portrait (Gemini) ----------------
def test_witness_portrait_and_cache(api):
    url = f"{BASE_URL}/api/witness/case-johnson-1047/w1/portrait"
    r1 = api.get(url, timeout=60)
    assert r1.status_code == 200
    j1 = r1.json()
    assert "data_url" in j1
    assert j1["data_url"].startswith("data:image/") or j1["data_url"] == "", \
        f"unexpected data_url prefix: {j1['data_url'][:60]!r}"
    if not j1["data_url"]:
        pytest.skip("Portrait generation returned empty (LLM/gemini path). Reported.")

    # second call must be cached (< 3s)
    t0 = time.time()
    r2 = api.get(url, timeout=30)
    elapsed = time.time() - t0
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2["cached"] is True
    assert j2["data_url"] == j1["data_url"]
    assert elapsed < 3.0, f"cached call took {elapsed:.2f}s"


def test_witness_portrait_404(api):
    r = api.get(f"{BASE_URL}/api/witness/case-johnson-1047/does-not-exist/portrait", timeout=15)
    assert r.status_code == 404


# ---------------- Highlight reel ----------------
@pytest.fixture(scope="module")
def highlight_replay(api):
    """Save a crafted replay with a contradiction, sustained ruling, and evidence line."""
    payload = {
        "user_id": "TEST_hl_user",
        "case_id": "case-johnson-1047",
        "case_title": "United States v. Johnson",
        "role": "prosecutor",
        "verdict": "GUILTY",
        "per_charge": {"Conspiracy (18 U.S.C. § 371)": "GUILTY"},
        "sentence": "15 years federal custody",
        "xp_earned": 150,
        "transcript": [
            {"speaker": "Prosecution", "role": "lawyer", "text": "The People call Agent Ruiz."},
            {"speaker": "Agent Ruiz", "role": "witness", "text": "I personally observed the meet."},
            {"speaker": "System", "role": "system", "text": "⚡ The witness contradicts her earlier statement."},
            {"speaker": "Defense", "role": "lawyer", "text": "Objection, hearsay!"},
            {"speaker": "Judge", "role": "judge", "text": "Sustained. Rephrase counsel."},
            {"speaker": "Prosecution", "role": "lawyer", "text": "The People moves to admit Exhibit 3."},
        ],
        "stats": {"evidence_introduced": 1, "witnesses_examined": 1},
    }
    r = api.post(f"{BASE_URL}/api/replays/save", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    yield j
    api.delete(f"{BASE_URL}/api/replays/{j['id']}", timeout=15)


def test_highlights_extraction(api, highlight_replay):
    r = api.get(f"{BASE_URL}/api/replays/{highlight_replay['id']}/highlights", timeout=15)
    assert r.status_code == 200
    hl = r.json()
    assert isinstance(hl, list)
    assert 1 <= len(hl) <= 5
    kinds = [h["kind"] for h in hl]
    for expected_kind in ("contradiction", "objection_sustained", "evidence", "verdict"):
        assert expected_kind in kinds, f"missing kind {expected_kind} in {kinds}"
    # sorted desc by score
    scores = [h["score"] for h in hl]
    assert scores == sorted(scores, reverse=True), f"not sorted desc: {scores}"
    # allowed kinds only
    allowed = {"contradiction", "objection_sustained", "objection_overruled", "evidence", "verdict"}
    assert set(kinds).issubset(allowed)


def test_highlights_404(api):
    r = api.get(f"{BASE_URL}/api/replays/does-not-exist/highlights", timeout=15)
    assert r.status_code == 404
