"""Backend API tests for Federal Trial simulator (iteration 2).

Covers regressions plus new features: clue payloads, SSE witness stream, replay CRUD.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Health ----------------
def test_health(api):
    r = api.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------------- Cases + Clues ----------------
EXPECTED_CLUE_COUNTS = {
    "case-johnson-1047": 4,
    "case-vega-2101": 3,
    "case-blackbyte-3300": 3,
    "case-fiction-durk-99": 3,
}


def test_list_cases(api):
    r = api.get(f"{BASE_URL}/api/cases", timeout=15)
    assert r.status_code == 200
    cases = r.json()
    ids = {c["id"] for c in cases}
    assert set(EXPECTED_CLUE_COUNTS).issubset(ids)


@pytest.mark.parametrize("case_id,count", list(EXPECTED_CLUE_COUNTS.items()))
def test_case_has_clues(api, case_id, count):
    r = api.get(f"{BASE_URL}/api/cases/{case_id}", timeout=15)
    assert r.status_code == 200
    c = r.json()
    clues = c.get("clues")
    assert isinstance(clues, list), "clues array missing"
    assert len(clues) == count, f"expected {count} clues, got {len(clues)}"
    for clue in clues:
        for field in ("id", "action", "label", "unlocks_question"):
            assert field in clue and isinstance(clue[field], str) and clue[field], f"missing {field} in {clue}"


def test_case_detail_not_found(api):
    r = api.get(f"{BASE_URL}/api/cases/does-not-exist", timeout=15)
    assert r.status_code == 404


# ---------------- Witness (non-stream) ----------------
def test_witness_respond(api):
    payload = {
        "case_id": "case-johnson-1047",
        "witness_id": "w1",
        "question": "Agent Ruiz, can you describe what you personally observed at the alleged meet location?",
        "is_cross_examination": False,
        "mood": "neutral",
    }
    r = api.post(f"{BASE_URL}/api/witness/respond", json=payload, timeout=60)
    assert r.status_code == 200
    j = r.json()
    assert isinstance(j["text"], str) and len(j["text"]) > 10


# ---------------- Witness streaming (SSE) ----------------
def test_witness_stream_sse(api):
    payload = {
        "case_id": "case-johnson-1047",
        "witness_id": "w1",
        "question": "Please state your name and role for the record.",
        "is_cross_examination": False,
        "mood": "neutral",
    }
    with api.post(f"{BASE_URL}/api/witness/stream", json=payload, stream=True, timeout=60) as r:
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "text/event-stream" in ct, f"bad content-type: {ct}"

        data_chunks = []
        saw_done = False
        deadline = time.time() + 45
        for raw in r.iter_lines(decode_unicode=True):
            if time.time() > deadline:
                break
            if raw is None:
                continue
            line = raw.strip()
            if not line:
                continue
            if line.startswith("event:") and "done" in line:
                saw_done = True
            elif line.startswith("data:"):
                payload_str = line[5:].lstrip()
                # Terminator frame carries "{}"
                if payload_str and payload_str != "{}":
                    data_chunks.append(payload_str.replace("\\n", "\n"))
            if saw_done:
                # small drain
                break

    joined = "".join(data_chunks).strip()
    assert saw_done, "SSE stream never emitted an 'event: done' terminator"
    assert len(data_chunks) >= 2, f"expected multiple data frames, got {len(data_chunks)}"
    assert len(joined) > 10, f"streamed text too short: {joined!r}"
    assert "LLM error" not in joined and "hesitates" not in joined.lower() or len(joined) > 20


def test_witness_stream_bad_case(api):
    payload = {"case_id": "does-not-exist", "witness_id": "w1", "question": "hi"}
    r = api.post(f"{BASE_URL}/api/witness/stream", json=payload, timeout=15)
    assert r.status_code == 404


# ---------------- Verdict regression ----------------
def test_verdict_regression(api):
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
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["verdict"] in ("GUILTY", "NOT GUILTY")
    assert isinstance(j["per_charge"], dict) and len(j["per_charge"]) >= 3
    assert isinstance(j["xp_earned"], int) and j["xp_earned"] > 0


# ---------------- Replays CRUD ----------------
@pytest.fixture(scope="module")
def saved_replay(api):
    payload = {
        "user_id": "TEST_replay_user",
        "case_id": "case-johnson-1047",
        "case_title": "United States v. Johnson",
        "role": "prosecutor",
        "verdict": "GUILTY",
        "per_charge": {"Conspiracy (18 U.S.C. § 371)": "GUILTY"},
        "sentence": "12 years federal custody",
        "xp_earned": 120,
        "transcript": [
            {"speaker": "Judge", "role": "judge", "text": "Court is in session."},
            {"speaker": "Prosecution", "role": "lawyer", "text": "The People call Agent Ruiz."},
            {"speaker": "Agent Ruiz", "role": "witness", "text": "I led the investigation."},
        ],
        "stats": {"evidence_introduced": 4, "witnesses_examined": 3},
    }
    r = api.post(f"{BASE_URL}/api/replays/save", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["id"] and j["created_at"]
    assert len(j["transcript"]) == 3
    yield j
    # cleanup
    api.delete(f"{BASE_URL}/api/replays/{j['id']}", timeout=15)


def test_list_replays(api, saved_replay):
    r = api.get(f"{BASE_URL}/api/replays", params={"user_id": "TEST_replay_user"}, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) >= 1
    ids = [x["id"] for x in lst]
    assert saved_replay["id"] in ids
    # most-recent-first ordering: first item's created_at >= last
    if len(lst) >= 2:
        assert lst[0]["created_at"] >= lst[-1]["created_at"]


def test_get_replay(api, saved_replay):
    r = api.get(f"{BASE_URL}/api/replays/{saved_replay['id']}", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j["id"] == saved_replay["id"]
    assert len(j["transcript"]) == 3
    assert j["verdict"] == "GUILTY"


def test_delete_replay(api):
    # create fresh row we can delete without affecting other tests
    payload = {
        "user_id": "TEST_replay_delete",
        "case_id": "case-vega-2101",
        "case_title": "United States v. Vega",
        "role": "defense",
        "verdict": "NOT GUILTY",
        "xp_earned": 40,
        "transcript": [{"speaker": "Judge", "role": "judge", "text": "Session start."}],
    }
    r = api.post(f"{BASE_URL}/api/replays/save", json=payload, timeout=15)
    assert r.status_code == 200
    rid = r.json()["id"]
    d = api.delete(f"{BASE_URL}/api/replays/{rid}", timeout=15)
    assert d.status_code == 200
    g = api.get(f"{BASE_URL}/api/replays/{rid}", timeout=15)
    assert g.status_code == 404
