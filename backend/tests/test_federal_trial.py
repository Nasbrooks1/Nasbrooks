"""Backend API tests for Federal Trial simulator."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://trial-flow-3.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Health ----------------
def test_health(api):
    r = api.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("ok") is True


# ---------------- Cases ----------------
def test_list_cases(api):
    r = api.get(f"{BASE_URL}/api/cases", timeout=15)
    assert r.status_code == 200
    cases = r.json()
    ids = {c["id"] for c in cases}
    expected = {"case-johnson-1047", "case-vega-2101", "case-blackbyte-3300", "case-fiction-durk-99"}
    assert expected.issubset(ids), f"Missing seeded cases: {expected - ids}"
    for c in cases:
        if c["id"] == "case-johnson-1047":
            assert len(c["charges"]) >= 3
            assert len(c["evidence"]) >= 3
            assert len(c["witnesses"]) >= 3


def test_filter_celebrity(api):
    r = api.get(f"{BASE_URL}/api/cases", params={"category": "celebrity"}, timeout=15)
    assert r.status_code == 200
    cases = r.json()
    assert len(cases) >= 1
    assert all(c["category"] == "celebrity" for c in cases)
    assert any(c["id"] == "case-fiction-durk-99" for c in cases)


def test_case_detail(api):
    r = api.get(f"{BASE_URL}/api/cases/case-johnson-1047", timeout=15)
    assert r.status_code == 200
    c = r.json()
    assert c["title"] == "United States v. Johnson"
    assert len(c["witnesses"]) == 3


def test_case_detail_not_found(api):
    r = api.get(f"{BASE_URL}/api/cases/does-not-exist", timeout=15)
    assert r.status_code == 404


# ---------------- Witness ----------------
def test_witness_respond(api):
    payload = {
        "case_id": "case-johnson-1047",
        "witness_id": "w1",
        "question": "Agent Ruiz, can you describe what you personally observed at the alleged meet location?",
        "is_cross_examination": False,
        "mood": "neutral",
    }
    r = api.post(f"{BASE_URL}/api/witness/respond", json=payload, timeout=45)
    assert r.status_code == 200
    j = r.json()
    assert "text" in j and "mood" in j and "contradicted" in j
    assert isinstance(j["text"], str) and len(j["text"]) > 10, f"Reply too short: {j['text']!r}"
    assert isinstance(j["contradicted"], bool)


# ---------------- Objection ----------------
def test_objection_hearsay(api):
    payload = {
        "objection_type": "Hearsay",
        "question": "What did the informant tell you the defendant said?",
        "context": "During direct examination of the federal agent.",
    }
    r = api.post(f"{BASE_URL}/api/objection/rule", json=payload, timeout=45)
    assert r.status_code == 200
    j = r.json()
    assert j["ruling"] in ("sustained", "overruled")
    assert isinstance(j["reasoning"], str) and len(j["reasoning"]) > 0


# ---------------- Verdict ----------------
def test_verdict(api):
    payload = {
        "case_id": "case-johnson-1047",
        "stats": {
            "case_id": "case-johnson-1047",
            "role": "prosecutor",
            "objections_won": 3,
            "objections_lost": 1,
            "evidence_introduced": 4,
            "witnesses_examined": 3,
            "contradictions_exposed": 1,
            "motions_granted": 1,
            "motions_denied": 0,
        },
    }
    r = api.post(f"{BASE_URL}/api/verdict", json=payload, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j["verdict"] in ("GUILTY", "NOT GUILTY")
    assert isinstance(j["per_charge"], dict) and len(j["per_charge"]) >= 3
    assert isinstance(j["xp_earned"], int) and j["xp_earned"] > 0
    if j["verdict"] == "GUILTY":
        assert j["sentence"] and "years" in j["sentence"]


# ---------------- Career ----------------
def test_career_guest_default(api):
    r = api.get(f"{BASE_URL}/api/career/guest", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["user_id"] == "guest"
    assert j["level"] == 1
    assert j["xp"] == 0
    assert j["rank"] == "Law Student"


def test_career_save_and_rank_derivation(api):
    payload = {
        "user_id": "TEST_user_pytest",
        "level": 12,
        "xp": 1500,
        "rank": "ignored",
        "role_focus": "prosecutor",
        "completed_cases": ["case-johnson-1047"],
    }
    r = api.post(f"{BASE_URL}/api/career/save", json=payload, timeout=15)
    assert r.status_code == 200
    j = r.json()
    # level 12 -> should map to "Defense Attorney" (>=10)
    assert j["rank"] == "Defense Attorney", f"Unexpected rank: {j['rank']}"
    # Verify persistence
    r2 = api.get(f"{BASE_URL}/api/career/TEST_user_pytest", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["level"] == 12
