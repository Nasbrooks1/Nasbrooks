from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import re
from pathlib import Path
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Federal Trial API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class Witness(BaseModel):
    id: str
    name: str
    role: str  # e.g. "Eyewitness", "Federal Agent", "Expert"
    persona: str  # short description used by the LLM
    key_facts: List[str] = []

class Evidence(BaseModel):
    id: str
    label: str
    kind: str  # photo, document, video, message, financial, forensic
    summary: str

class Case(BaseModel):
    id: str
    case_number: str
    title: str  # "United States v. Johnson"
    category: str  # violent, financial, drug, cyber, corruption, organized, celebrity
    difficulty: str  # Rookie, Veteran, Elite
    charges: List[str]
    synopsis: str
    is_celebrity_inspired: bool = False
    hero_image: Optional[str] = None
    evidence: List[Evidence] = []
    witnesses: List[Witness] = []

class WitnessRequest(BaseModel):
    case_id: str
    witness_id: str
    question: str
    is_cross_examination: bool = False
    mood: str = "neutral"  # neutral, nervous, hostile, confident

class WitnessResponse(BaseModel):
    text: str
    mood: str
    contradicted: bool

class ObjectionRequest(BaseModel):
    objection_type: str  # Hearsay, Relevance, Speculation, Leading, Foundation, Asked and Answered, Argumentative
    question: str
    context: Optional[str] = ""

class ObjectionRuling(BaseModel):
    ruling: str  # "sustained" | "overruled"
    reasoning: str

class TrialStats(BaseModel):
    case_id: str
    role: str
    objections_won: int = 0
    objections_lost: int = 0
    evidence_introduced: int = 0
    witnesses_examined: int = 0
    contradictions_exposed: int = 0
    motions_granted: int = 0
    motions_denied: int = 0

class VerdictRequest(BaseModel):
    case_id: str
    stats: TrialStats

class VerdictResponse(BaseModel):
    verdict: str  # GUILTY / NOT GUILTY
    per_charge: Dict[str, str]
    summary: str
    sentence: Optional[str] = None
    xp_earned: int

class CareerProgress(BaseModel):
    user_id: str
    level: int = 1
    xp: int = 0
    rank: str = "Law Student"
    role_focus: str = "prosecutor"
    completed_cases: List[str] = []

# --------------------------------------------------------------------------
# Seed cases
# --------------------------------------------------------------------------
SEED_CASES: List[Case] = [
    Case(
        id="case-johnson-1047",
        case_number="1047",
        title="United States v. Johnson",
        category="organized",
        difficulty="Veteran",
        charges=["Conspiracy (18 U.S.C. § 371)", "Firearms Offense (18 U.S.C. § 924(c))", "Witness Tampering (18 U.S.C. § 1512)"],
        synopsis="A racketeering conspiracy alleged to have trafficked firearms across state lines. The government's key cooperator faces credibility questions after a leaked jailhouse call.",
        hero_image="https://images.pexels.com/photos/6077326/pexels-photo-6077326.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        evidence=[
            Evidence(id="e1", label="Wiretap Audio #17", kind="video", summary="Recorded call referencing 'the shipment' the night before the seizure."),
            Evidence(id="e2", label="Cellular Tower Map", kind="document", summary="Places defendant within one mile of the meet location."),
            Evidence(id="e3", label="Firearm Ballistics Report", kind="forensic", summary="Two recovered firearms match casings from an unrelated shooting."),
            Evidence(id="e4", label="Encrypted Chat Log", kind="message", summary="Signal messages between co-defendants coordinating a hand-off."),
        ],
        witnesses=[
            Witness(id="w1", name="Special Agent Diane Ruiz", role="Federal Agent",
                    persona="A calm, 18-year ATF veteran. Answers in short precise sentences. Uses cop language. Dislikes speculation.",
                    key_facts=["Led the wiretap authorization", "Personally observed the alleged meet", "Chain of custody was preserved"]),
            Witness(id="w2", name="Marcus 'Tank' Reeves", role="Cooperating Witness",
                    persona="A cooperator working off his own 20-year exposure. Nervous, defensive, occasionally aggressive. Slips into slang under pressure.",
                    key_facts=["Was inside the vehicle on the night of the meet", "Has three prior felony convictions", "Received a 5K1.1 letter"]),
            Witness(id="w3", name="Dr. Alan Kim", role="Ballistics Expert",
                    persona="A soft-spoken forensic scientist. Explains methodology carefully. Concedes limits of the science when pressed.",
                    key_facts=["Compared 14 striations on recovered casings", "Uses AFTE methodology", "Concedes match probability is not statistical"]),
        ],
    ),
    Case(
        id="case-vega-2101",
        case_number="2101",
        title="United States v. Vega",
        category="financial",
        difficulty="Rookie",
        charges=["Wire Fraud (18 U.S.C. § 1343)", "Money Laundering (18 U.S.C. § 1956)"],
        synopsis="A boutique investment advisor is accused of routing client funds through an offshore shell to conceal a $4.2M shortfall.",
        hero_image="https://images.pexels.com/photos/6077430/pexels-photo-6077430.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        evidence=[
            Evidence(id="e1", label="SWIFT Wire Records", kind="financial", summary="$4.2M in transfers to Belize entity 'Coral Holdings LLC'."),
            Evidence(id="e2", label="Client Email Thread", kind="message", summary="Defendant assures clients funds are 'in a domestic escrow account.'"),
            Evidence(id="e3", label="Forensic Accounting Report", kind="forensic", summary="Traces commingling of client funds and personal expenses."),
        ],
        witnesses=[
            Witness(id="w1", name="Elena Vega", role="Defendant",
                    persona="Poised, articulate. Frames every answer around her fiduciary duty. Slightly defensive when asked about Belize.",
                    key_facts=["Signed the wire authorizations", "Claims Coral Holdings was a legitimate reinsurance vehicle", "Denies personal use"]),
            Witness(id="w2", name="Priya Shah", role="Victim Client",
                    persona="Retired teacher. Emotional. Trusted the defendant for 12 years.",
                    key_facts=["Invested $380k of retirement savings", "Received falsified quarterly statements", "Lost approximately 90% of principal"]),
        ],
    ),
    Case(
        id="case-blackbyte-3300",
        case_number="3300",
        title="United States v. Nakamura",
        category="cyber",
        difficulty="Elite",
        charges=["Computer Fraud (18 U.S.C. § 1030)", "Aggravated Identity Theft (18 U.S.C. § 1028A)"],
        synopsis="A former systems administrator is charged with exfiltrating 2.3M patient records and staging a ransomware event to cover their tracks.",
        hero_image="https://images.pexels.com/photos/8382083/pexels-photo-8382083.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        evidence=[
            Evidence(id="e1", label="VPN Login Anomalies", kind="forensic", summary="Root credentials used from an IP in Vilnius at 3:14am local time."),
            Evidence(id="e2", label="Cryptocurrency Trail", kind="financial", summary="4.7 BTC moved through a Wasabi mixer, partial deanonymization complete."),
            Evidence(id="e3", label="GitHub Commit History", kind="document", summary="Defendant's private repo contains a near-identical exfiltration script."),
        ],
        witnesses=[
            Witness(id="w1", name="Kenji Nakamura", role="Defendant",
                    persona="Highly technical, precise, corrects legal jargon. Grows defensive when asked about the private repo.",
                    key_facts=["Was terminated 11 days before the incident", "Kept his personal VPN client on the work laptop", "Denies moving any BTC"]),
            Witness(id="w2", name="CISO Marla Chen", role="Corporate Witness",
                    persona="Blunt, hurried. Speaks in acronyms. Slightly hostile to defense.",
                    key_facts=["Revoked defendant's access on termination", "Only two admins had root", "The audit log had a 42-minute gap"]),
        ],
    ),
    Case(
        id="case-fiction-durk-99",
        case_number="99-F",
        title="United States v. \"D. Banks\" (Fictionalized)",
        category="celebrity",
        difficulty="Veteran",
        charges=["Conspiracy (18 U.S.C. § 371)", "Firearms Offense (18 U.S.C. § 924(c))"],
        synopsis="FICTIONAL CASE inspired by public federal prosecutions of hip-hop artists. All names, facts, and dialogue are invented for gameplay and do not represent any real person's conduct.",
        is_celebrity_inspired=True,
        hero_image="https://images.pexels.com/photos/6077326/pexels-photo-6077326.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        evidence=[
            Evidence(id="e1", label="Music Video Still", kind="photo", summary="A firearm visible in a fictional lyric video timestamped after the alleged offense."),
            Evidence(id="e2", label="Private Jet Manifest", kind="document", summary="Places the fictional defendant in a different state on the night in question."),
            Evidence(id="e3", label="Instagram DM Screenshot", kind="message", summary="A cryptic message the government alleges is coded language."),
        ],
        witnesses=[
            Witness(id="w1", name="'D. Banks'", role="Defendant (Fictional)",
                    persona="Composed, confident, media-savvy. Speaks in short careful sentences. Denies coded language allegations.",
                    key_facts=["Was on tour during the alleged offense", "The jet manifest is corroborated by TSA", "Lyrics are fiction"]),
            Witness(id="w2", name="Detective Ray Coles", role="Case Agent",
                    persona="Career homicide detective, direct, occasionally sarcastic. Believes lyrics are admissions.",
                    key_facts=["Interpreted three social media posts as admissions", "Did not obtain a physical firearm from defendant", "Relied on a confidential informant"]),
        ],
    ),
]

async def seed_cases():
    for case in SEED_CASES:
        await db.cases.update_one(
            {"id": case.id},
            {"$set": case.model_dump()},
            upsert=True,
        )
    logger.info(f"Seeded {len(SEED_CASES)} cases")

@app.on_event("startup")
async def on_startup():
    await seed_cases()

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# --------------------------------------------------------------------------
# LLM helper
# --------------------------------------------------------------------------
async def llm_complete(system: str, user: str, session_id: str) -> str:
    """Single-shot LLM call using Claude Sonnet 4.6 via Emergent universal key."""
    if not EMERGENT_LLM_KEY:
        return "[LLM key missing — returning placeholder testimony.]"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-6")
        reply = await chat.send_message(UserMessage(text=user))
        return str(reply).strip()
    except Exception as e:
        logger.exception("LLM call failed")
        return f"[The witness hesitates.] (LLM error: {type(e).__name__})"

# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "Federal Trial", "ok": True}

@api.get("/cases", response_model=List[Case])
async def list_cases(category: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category and category != "all":
        q["category"] = category
    docs = await db.cases.find(q, {"_id": 0}).to_list(200)
    return [Case(**d) for d in docs]

@api.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str):
    doc = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Case not found")
    return Case(**doc)

@api.post("/witness/respond", response_model=WitnessResponse)
async def witness_respond(req: WitnessRequest):
    case_doc = await db.cases.find_one({"id": req.case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found")
    case = Case(**case_doc)
    witness = next((w for w in case.witnesses if w.id == req.witness_id), None)
    if not witness:
        raise HTTPException(404, "Witness not found")

    system = (
        "You are a witness testifying under oath in a fictional federal courtroom simulator game. "
        "Stay strictly in character. Answer only what is asked. Do NOT narrate stage directions in prose — "
        "return a short spoken reply (1-3 sentences). If the question is compound or leading, you may push back. "
        "You occasionally make small memory mistakes when nervous. Never break the fourth wall.\n\n"
        f"CASE: {case.title} — charges: {', '.join(case.charges)}.\n"
        f"CASE FACTS: {case.synopsis}\n"
        f"YOU ARE: {witness.name}, {witness.role}.\n"
        f"PERSONA: {witness.persona}\n"
        f"KEY FACTS YOU KNOW: {'; '.join(witness.key_facts)}\n"
        f"CURRENT MOOD: {req.mood}. "
        f"{'This is CROSS-EXAMINATION — the opposing lawyer is trying to trip you up.' if req.is_cross_examination else 'This is DIRECT examination.'}"
    )
    user = f"Question from the lawyer: \"{req.question}\"\n\nReply as the witness in 1-3 spoken sentences."
    text = await llm_complete(system, user, f"witness-{req.case_id}-{req.witness_id}")

    # Simple heuristics for mood shift / contradiction detection
    low = text.lower()
    contradicted = any(k in low for k in ["i was wrong", "i mis-spoke", "i misspoke", "i don't recall", "actually", "correction"])
    new_mood = req.mood
    if req.is_cross_examination and random.random() < 0.35:
        new_mood = random.choice(["nervous", "defensive", "hostile"])

    return WitnessResponse(text=text, mood=new_mood, contradicted=contradicted)

@api.post("/objection/rule", response_model=ObjectionRuling)
async def objection_rule(req: ObjectionRequest):
    system = (
        "You are a federal judge in a courtroom simulator game. A lawyer just raised an objection. "
        "Rule 'sustained' or 'overruled' in ONE lowercase word on the first line, then give ONE crisp sentence "
        "(<=25 words) of reasoning in judge voice. Base your ruling on the Federal Rules of Evidence."
    )
    user = (
        f"Objection type: {req.objection_type}\n"
        f"Question that was asked: \"{req.question}\"\n"
        f"Extra context: {req.context or 'none'}"
    )
    text = await llm_complete(system, user, f"obj-{uuid.uuid4()}")

    ruling = "overruled"
    reasoning = text
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if lines:
        first = lines[0].lower().strip(".:,-")
        if "sustain" in first:
            ruling = "sustained"
        elif "overrule" in first:
            ruling = "overruled"
        # Try to extract reasoning
        m = re.search(r"(sustained|overruled)[\.:,\-\s]+(.*)", text, re.IGNORECASE | re.DOTALL)
        if m:
            reasoning = m.group(2).strip()
    return ObjectionRuling(ruling=ruling, reasoning=reasoning[:400])

@api.post("/verdict", response_model=VerdictResponse)
async def compute_verdict(req: VerdictRequest):
    case_doc = await db.cases.find_one({"id": req.case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found")
    case = Case(**case_doc)

    # Simple scoring: prosecution needs strong evidence introduction and objection wins
    s = req.stats
    prosecution_score = (
        s.evidence_introduced * 8
        + s.witnesses_examined * 5
        + s.objections_won * 4
        - s.contradictions_exposed * 6
        - s.objections_lost * 3
    )
    if req.stats.role == "defense":
        # For defense role, "won" objections and contradictions hurt prosecution
        prosecution_score = (
            (s.witnesses_examined * 3)
            - (s.contradictions_exposed * 10)
            - (s.objections_won * 5)
            + (s.objections_lost * 3)
            + 20
        )

    per_charge: Dict[str, str] = {}
    guilty_count = 0
    for i, ch in enumerate(case.charges):
        threshold = 15 + i * 5
        guilty = prosecution_score >= threshold
        per_charge[ch] = "GUILTY" if guilty else "NOT GUILTY"
        if guilty:
            guilty_count += 1

    overall = "GUILTY" if guilty_count > 0 else "NOT GUILTY"
    sentence = None
    if overall == "GUILTY":
        yrs = min(30, 5 + guilty_count * 7 + random.randint(0, 4))
        sentence = f"{yrs} years federal custody, followed by 3 years supervised release, $100 special assessment per count."

    xp = 40 + s.evidence_introduced * 5 + s.objections_won * 8 + s.contradictions_exposed * 10
    summary_lines = [
        f"The jury reviewed {s.evidence_introduced} pieces of evidence and heard from {s.witnesses_examined} witnesses.",
        f"Objections won: {s.objections_won}. Objections lost: {s.objections_lost}. Contradictions exposed: {s.contradictions_exposed}.",
        f"Verdict: {overall} on {guilty_count} of {len(case.charges)} count(s).",
    ]
    return VerdictResponse(
        verdict=overall,
        per_charge=per_charge,
        summary=" ".join(summary_lines),
        sentence=sentence,
        xp_earned=xp,
    )

@api.get("/career/{user_id}", response_model=CareerProgress)
async def get_career(user_id: str):
    doc = await db.career.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return CareerProgress(user_id=user_id)
    return CareerProgress(**doc)

@api.post("/career/save", response_model=CareerProgress)
async def save_career(prog: CareerProgress):
    # Auto-derive rank from level
    ranks = [
        (1, "Law Student"),
        (5, "Public Defender"),
        (10, "Defense Attorney"),
        (20, "Federal Prosecutor"),
        (30, "Senior Trial Attorney"),
        (40, "Federal Judge"),
    ]
    rank = "Law Student"
    for lvl, name in ranks:
        if prog.level >= lvl:
            rank = name
    prog.rank = rank
    await db.career.update_one(
        {"user_id": prog.user_id},
        {"$set": prog.model_dump()},
        upsert=True,
    )
    return prog

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
