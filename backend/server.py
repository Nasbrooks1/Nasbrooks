from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import random
import re
import hashlib
import base64
from pathlib import Path
from datetime import datetime, timezone, date
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

class Clue(BaseModel):
    id: str
    action: str  # matches investigation action key: witnesses, phone, surveillance, documents, financial, forensic
    label: str  # short clue name shown in investigation folder
    unlocks_question: str  # the cross-examination question this clue unlocks

class Judge(BaseModel):
    name: str
    personality: str  # strict, lenient, by-the-book, tech-skeptic
    tagline: str
    sustain_bias: float = 0.0  # -1.0 (lenient, over-rule everything) to +1.0 (strict, sustain everything)

class Case(BaseModel):
    id: str
    case_number: str
    title: str  # "United States v. Johnson"
    category: str  # violent, financial, drug, cyber, corruption, organized, celebrity
    difficulty: str  # Rookie, Veteran, Elite
    charges: List[str]
    synopsis: str
    is_celebrity_inspired: bool = False
    is_daily: bool = False
    hero_image: Optional[str] = None
    evidence: List[Evidence] = []
    witnesses: List[Witness] = []
    clues: List[Clue] = []
    judge: Optional[Judge] = None

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
    case_id: Optional[str] = None

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

class TranscriptLine(BaseModel):
    speaker: str
    role: str  # judge, lawyer, witness, system
    text: str

class Replay(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "guest"
    case_id: str
    case_title: str
    role: str
    verdict: str
    per_charge: Dict[str, str] = {}
    sentence: Optional[str] = None
    xp_earned: int = 0
    transcript: List[TranscriptLine] = []
    stats: Dict[str, int] = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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
        clues=[
            Clue(id="c1", action="phone", label="Burner phone ping 3.2 miles away", unlocks_question="If you personally observed the meet, why do your own cell tower records place your handset 3.2 miles away that night?"),
            Clue(id="c2", action="witnesses", label="Cooperator's 5K1.1 letter", unlocks_question="You signed a 5K1.1 cooperation agreement to reduce your own 20-year exposure, didn't you?"),
            Clue(id="c3", action="forensic", label="AFTE methodology has no error rate", unlocks_question="Doctor, the AFTE toolmark methodology has no established statistical error rate, correct?"),
            Clue(id="c4", action="surveillance", label="Missing 14-minute window on the pole cam", unlocks_question="There's a 14-minute gap in the pole-camera footage right before the alleged hand-off, isn't there?"),
        ],
        judge=Judge(
            name="Hon. Marilyn Hartwell",
            personality="strict",
            tagline="Twenty-two years on the bench. Runs a tight courtroom. Hard on hearsay and foundation.",
            sustain_bias=0.35,
        ),
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
        clues=[
            Clue(id="c1", action="financial", label="Coral Holdings has no reinsurance license", unlocks_question="Coral Holdings LLC has never held a reinsurance license in Belize or anywhere else, has it?"),
            Clue(id="c2", action="documents", label="Falsified quarterly statement", unlocks_question="You personally signed off on quarterly statements that inflated returns by 240%, correct?"),
            Clue(id="c3", action="phone", label="Personal spending on client account", unlocks_question="A $47,000 Bulgari watch was purchased from the same account you told clients was in escrow, wasn't it?"),
        ],
        judge=Judge(
            name="Hon. Samuel Ortiz",
            personality="by-the-book",
            tagline="Former SEC attorney. Methodical. Rewards precise legal grounds; rarely rules on gut.",
            sustain_bias=0.05,
        ),
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
        clues=[
            Clue(id="c1", action="forensic", label="42-minute audit log gap during exfiltration", unlocks_question="The 42-minute audit log gap begins exactly one minute before the exfiltration and ends one minute after, correct?"),
            Clue(id="c2", action="documents", label="Second admin credentials also active that night", unlocks_question="A second administrator account was actively authenticated on the network during the same window, wasn't it?"),
            Clue(id="c3", action="financial", label="BTC wallet clustered to another employee", unlocks_question="Chain-analysis clusters the destination BTC wallet to a device that never belonged to my client, doesn't it?"),
        ],
        judge=Judge(
            name="Hon. Ruth Bergman",
            personality="tech-skeptic",
            tagline="Old-school. Distrusts unexplained tech jargon. Will sustain speculation on anything involving code or crypto.",
            sustain_bias=0.25,
        ),
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
        clues=[
            Clue(id="c1", action="documents", label="TSA manifest corroborates tour date", unlocks_question="TSA logs and the private-jet manifest independently place my client in a different state that night, correct?"),
            Clue(id="c2", action="surveillance", label="Music video shot 3 weeks after offense", unlocks_question="The music video you rely on was filmed and released three weeks after the alleged offense, wasn't it?"),
            Clue(id="c3", action="witnesses", label="Confidential informant is a rival's manager", unlocks_question="Your confidential informant is the manager of a competing artist with an active copyright dispute against my client, isn't he?"),
        ],
        judge=Judge(
            name="Hon. Charles Whitmore",
            personality="lenient",
            tagline="Former public defender. Trusts the jury. Overrules more than he sustains — lets the record breathe.",
            sustain_bias=-0.3,
        ),
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
    if case_id == "daily":
        return await get_daily_case()
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
    # Load judge personality if a case_id was supplied
    judge_note = "You are a federal judge in a courtroom simulator game."
    sustain_bias = 0.0
    if req.case_id:
        case_doc = await db.cases.find_one({"id": req.case_id}, {"_id": 0})
        if case_doc:
            case = Case(**case_doc)
            if case.judge:
                j = case.judge
                sustain_bias = j.sustain_bias
                judge_note = (
                    f"You are {j.name}, a federal judge with a {j.personality} personality. "
                    f"{j.tagline} Rule accordingly — your personality should color your ruling."
                )

    system = (
        f"{judge_note} A lawyer just raised an objection. "
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
        m = re.search(r"(sustained|overruled)[\.:,\-\s]+(.*)", text, re.IGNORECASE | re.DOTALL)
        if m:
            reasoning = m.group(2).strip()

    # Judge personality bias — small stochastic flip weighted by bias magnitude
    if sustain_bias != 0.0:
        r = random.random()
        # bias > 0 leans toward sustaining; if currently overruled, flip with prob = bias
        # bias < 0 leans toward overruling; if currently sustained, flip with prob = |bias|
        if ruling == "overruled" and sustain_bias > 0 and r < sustain_bias:
            ruling = "sustained"
            reasoning = f"On reflection — {reasoning}"
        elif ruling == "sustained" and sustain_bias < 0 and r < abs(sustain_bias):
            ruling = "overruled"
            reasoning = f"I'll let it stand — {reasoning}"

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

# --------------------------------------------------------------------------
# Streaming witness (SSE) — word-by-word delivery for dramatic testimony.
# --------------------------------------------------------------------------
from fastapi.responses import StreamingResponse

@api.post("/witness/stream")
async def witness_stream(req: WitnessRequest):
    case_doc = await db.cases.find_one({"id": req.case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found")
    case = Case(**case_doc)
    witness = next((w for w in case.witnesses if w.id == req.witness_id), None)
    if not witness:
        raise HTTPException(404, "Witness not found")

    system = (
        "You are a witness testifying under oath in a fictional federal courtroom simulator game. "
        "Stay strictly in character. Answer only what is asked. Return a short spoken reply (1-3 sentences). "
        "Never break the fourth wall.\n\n"
        f"CASE: {case.title} — charges: {', '.join(case.charges)}.\n"
        f"CASE FACTS: {case.synopsis}\n"
        f"YOU ARE: {witness.name}, {witness.role}.\n"
        f"PERSONA: {witness.persona}\n"
        f"KEY FACTS YOU KNOW: {'; '.join(witness.key_facts)}\n"
        f"CURRENT MOOD: {req.mood}. "
        f"{'This is CROSS-EXAMINATION.' if req.is_cross_examination else 'This is DIRECT examination.'}"
    )
    user_text = f"Question from the lawyer: \"{req.question}\"\n\nReply as the witness in 1-3 spoken sentences."

    async def event_generator():
        if not EMERGENT_LLM_KEY:
            yield "data: [LLM key missing]\n\n"
            yield "event: done\ndata: {}\n\n"
            return
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"witness-stream-{req.case_id}-{req.witness_id}",
                system_message=system,
            ).with_model("anthropic", "claude-sonnet-4-6")
            async for ev in chat.stream_message(UserMessage(text=user_text)):
                if isinstance(ev, TextDelta):
                    # Escape newlines for SSE data lines
                    safe = ev.content.replace("\r", "").replace("\n", "\\n")
                    yield f"data: {safe}\n\n"
                elif isinstance(ev, StreamDone):
                    yield "event: done\ndata: {}\n\n"
                    return
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            logger.exception("Streaming failed")
            yield f"data: [The witness hesitates. ({type(e).__name__})]\n\n"
            yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )

# --------------------------------------------------------------------------
# Replays
# --------------------------------------------------------------------------
@api.post("/replays/save", response_model=Replay)
async def save_replay(r: Replay):
    doc = r.model_dump()
    await db.replays.insert_one(doc)
    doc.pop("_id", None)
    return Replay(**doc)

@api.get("/replays", response_model=List[Replay])
async def list_replays(user_id: str = "guest"):
    docs = await db.replays.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Replay(**d) for d in docs]

@api.get("/replays/{replay_id}", response_model=Replay)
async def get_replay(replay_id: str):
    doc = await db.replays.find_one({"id": replay_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Replay not found")
    return Replay(**doc)

@api.delete("/replays/{replay_id}")
async def delete_replay(replay_id: str):
    await db.replays.delete_one({"id": replay_id})
    return {"ok": True}

# --------------------------------------------------------------------------
# Witness portraits (Gemini Nano Banana) — lazy generated and cached in MongoDB.
# --------------------------------------------------------------------------
class Portrait(BaseModel):
    key: str
    data_url: str
    created_at: str

async def _generate_portrait(witness: Witness) -> str:
    """Generate a base64 courtroom-sketch portrait. Returns a data URL."""
    if not EMERGENT_LLM_KEY:
        return ""
    prompt = (
        f"A monochrome courtroom sketch portrait, head and shoulders framing, "
        f"of a fictional character named {witness.name} who is a {witness.role}. "
        f"Character notes: {witness.persona}. "
        f"Style: pencil and ink on cream paper, loose expressive linework, cinematic dark lighting, "
        f"neutral background, no text, no watermarks. Single portrait, centered."
    )
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"portrait-{witness.id}-{uuid.uuid4()}",
        system_message="You are an illustrator generating character portraits.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        return ""
    img = images[0]
    mime = img.get("mime_type", "image/png")
    data = img.get("data", "")
    return f"data:{mime};base64,{data}"

@api.get("/witness/{case_id}/{witness_id}/portrait")
async def get_witness_portrait(case_id: str, witness_id: str):
    key = f"{case_id}::{witness_id}"
    cached = await db.portraits.find_one({"key": key}, {"_id": 0})
    if cached and cached.get("data_url"):
        return {"data_url": cached["data_url"], "cached": True}

    case_doc = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found")
    case = Case(**case_doc)
    witness = next((w for w in case.witnesses if w.id == witness_id), None)
    if not witness:
        raise HTTPException(404, "Witness not found")

    try:
        data_url = await _generate_portrait(witness)
    except Exception:
        logger.exception("Portrait gen failed")
        data_url = ""

    if data_url:
        await db.portraits.update_one(
            {"key": key},
            {"$set": {"key": key, "data_url": data_url, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    return {"data_url": data_url, "cached": False}

# --------------------------------------------------------------------------
# Trial highlight reel — heuristic extraction of the 5 best moments.
# --------------------------------------------------------------------------
class Highlight(BaseModel):
    kind: str  # contradiction, objection_sustained, objection_overruled, evidence, verdict
    speaker: str
    text: str
    score: int

def _extract_highlights(replay: Replay, limit: int = 5) -> List[Highlight]:
    scored: List[Highlight] = []
    lines = replay.transcript
    for i, l in enumerate(lines):
        text_l = l.text.lower()
        # Contradiction moments (system line flagged in transcript)
        if l.role == "system" and ("contradict" in text_l or "⚡" in l.text):
            # Attach the preceding witness line for context
            prev = next((lines[j] for j in range(i - 1, -1, -1) if lines[j].role == "witness"), None)
            scored.append(Highlight(kind="contradiction", speaker=(prev.speaker if prev else "WITNESS"),
                                    text=(prev.text if prev else l.text), score=100))
        elif l.role == "judge" and text_l.startswith("sustained"):
            scored.append(Highlight(kind="objection_sustained", speaker=l.speaker, text=l.text, score=80))
        elif l.role == "judge" and text_l.startswith("overruled"):
            scored.append(Highlight(kind="objection_overruled", speaker=l.speaker, text=l.text, score=40))
        elif l.role == "lawyer" and "moves to admit" in text_l:
            scored.append(Highlight(kind="evidence", speaker=l.speaker, text=l.text, score=60))
    # Always end with the verdict itself
    scored.append(Highlight(
        kind="verdict",
        speaker="JURY",
        text=f"Verdict: {replay.verdict}" + (f" — {replay.sentence}" if replay.sentence else ""),
        score=90,
    ))
    scored.sort(key=lambda h: h.score, reverse=True)
    return scored[:limit]

@api.get("/replays/{replay_id}/highlights", response_model=List[Highlight])
async def replay_highlights(replay_id: str):
    doc = await db.replays.find_one({"id": replay_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Replay not found")
    return _extract_highlights(Replay(**doc))

# --------------------------------------------------------------------------
# Daily case — one procedurally-blended case a day, cached in DB by date.
# --------------------------------------------------------------------------
DAILY_DEFENDANTS = [
    ("Randall", "Cooke"), ("Marisa", "Delgado"), ("Ike", "Sinclair"),
    ("Yvonne", "Park"), ("Devin", "Rasmussen"), ("Aya", "Nakashima"),
    ("Colton", "Frye"), ("Simone", "Bautista"),
]
DAILY_SCENARIOS = [
    {"cat": "violent", "diff": "Veteran", "synopsis": "A late-night warehouse hit alleged to be part of a broader turf war. The government's chief cooperator changed his story after receiving a plea offer.",
     "charges": ["Attempted Murder (18 U.S.C. § 1113)", "Firearms Offense (18 U.S.C. § 924(c))"],
     "witness_archetypes": [
        {"role": "Federal Agent", "persona": "Calm and clinical FBI Task Force veteran. Precise. Dislikes speculation.",
         "facts": ["Executed the search warrant", "Personally interviewed the cooperator twice", "Chain of custody preserved"]},
        {"role": "Cooperating Witness", "persona": "Nervous, defensive cooperator. Slips into slang when pressed.",
         "facts": ["Was on scene", "Has a 5K1.1 cooperation letter", "Two prior state convictions"]},
     ],
     "clues": [
        {"action": "phone", "label": "Cell records place defendant 4 miles away", "q": "Cell tower records place my client's handset four miles from the scene at the exact moment, don't they?"},
        {"action": "witnesses", "label": "Cooperator changed story after plea", "q": "You changed your written statement on three material points after receiving your plea offer, correct?"},
        {"action": "forensic", "label": "Shell casings never matched to defendant", "q": "None of the recovered shell casings can be forensically linked to any firearm in my client's possession, isn't that true?"},
     ]},
    {"cat": "financial", "diff": "Rookie", "synopsis": "A start-up CFO is accused of running a payroll skim through fake vendor accounts totalling $1.8M over four fiscal quarters.",
     "charges": ["Wire Fraud (18 U.S.C. § 1343)", "Aggravated Identity Theft (18 U.S.C. § 1028A)"],
     "witness_archetypes": [
        {"role": "Forensic Accountant", "persona": "Methodical, cites GAAP frequently. Concedes limits when pushed.",
         "facts": ["Traced 47 vendor invoices", "12 vendors have no independent existence", "Reconciliation gap: $1.8M"]},
        {"role": "Corporate Witness", "persona": "Blunt CEO. Angry the fraud happened under his nose.",
         "facts": ["Signed off on the vendor list quarterly", "Never met most vendors", "Fired the defendant on discovery"]},
     ],
     "clues": [
        {"action": "documents", "label": "Vendor W-9s share an address", "q": "Nine of the twelve vendor W-9s share the same suite number at a Delaware mailbox service, don't they?"},
        {"action": "financial", "label": "Personal card paid one 'vendor'", "q": "One of these vendor invoices was paid using my client's personal Amex, wasn't it?"},
     ]},
    {"cat": "drug", "diff": "Veteran", "synopsis": "A DEA sting alleged a cross-border MDMA lab, but the confidential informant later recanted key portions of his affidavit.",
     "charges": ["Conspiracy to Distribute (21 U.S.C. § 846)", "Manufacturing (21 U.S.C. § 841(a)(1))"],
     "witness_archetypes": [
        {"role": "Federal Agent", "persona": "DEA agent, direct, cold. Runs a large caseload.",
         "facts": ["Ran the CI for 14 months", "Executed the lab search", "Seized 400g of MDMA precursors"]},
        {"role": "Confidential Informant", "persona": "Evasive, working off a state charge. Hesitates before answers.",
         "facts": ["Signed a proffer letter", "Retracted portions of his affidavit", "Was paid $12k in DEA funds"]},
     ],
     "clues": [
        {"action": "witnesses", "label": "CI recanted three affidavit paragraphs", "q": "You submitted a sworn declaration recanting paragraphs 4, 7, and 12 of your original affidavit, didn't you?"},
        {"action": "forensic", "label": "Precursors below manufacturing threshold", "q": "The seized precursor amount falls below the DEA's own manufacturing-threshold guideline, correct?"},
     ]},
]
DAILY_HEROES = [
    "https://images.pexels.com/photos/6077326/pexels-photo-6077326.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.pexels.com/photos/8382083/pexels-photo-8382083.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "https://images.pexels.com/photos/6077430/pexels-photo-6077430.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
]
DAILY_JUDGES = [
    Judge(name="Hon. Priya Nair", personality="strict", tagline="Twenty years on the bench. No patience for imprecision.", sustain_bias=0.35),
    Judge(name="Hon. Marcus Lin", personality="lenient", tagline="Trusts the jury. Lets the record breathe.", sustain_bias=-0.3),
    Judge(name="Hon. Sarah Brenner", personality="by-the-book", tagline="Federal Rules of Evidence, verbatim. Every time.", sustain_bias=0.05),
    Judge(name="Hon. Emeka Adeyemi", personality="tech-skeptic", tagline="Unimpressed by jargon. Wants plain English.", sustain_bias=0.2),
]

def _build_daily_case(day: str) -> Case:
    seed = int(hashlib.sha256(day.encode()).hexdigest(), 16)
    rnd = random.Random(seed)
    first, last = rnd.choice(DAILY_DEFENDANTS)
    scenario = rnd.choice(DAILY_SCENARIOS)
    hero = rnd.choice(DAILY_HEROES)
    judge = rnd.choice(DAILY_JUDGES)
    case_no = f"D-{day.replace('-', '')}"
    witnesses: List[Witness] = []
    for i, w in enumerate(scenario["witness_archetypes"], start=1):
        witnesses.append(Witness(
            id=f"w{i}", name=f"{'Agent' if 'Agent' in w['role'] else ''} {rnd.choice(['Reed','Kim','Vega','Ortiz','Hale','Novak','Shah','Park'])}".strip(),
            role=w["role"], persona=w["persona"], key_facts=w["facts"],
        ))
    clues: List[Clue] = [
        Clue(id=f"c{i}", action=cl["action"], label=cl["label"], unlocks_question=cl["q"])
        for i, cl in enumerate(scenario["clues"], start=1)
    ]
    evidence: List[Evidence] = [
        Evidence(id="e1", label="Government Exhibit A", kind="document", summary="Primary charging document filed with the court."),
        Evidence(id="e2", label="Government Exhibit B", kind="forensic", summary="Forensic examiner's report tied to the alleged offense."),
        Evidence(id="e3", label="Government Exhibit C", kind="message", summary="Communications the government contends corroborate intent."),
    ]
    return Case(
        id=f"daily-{day}",
        case_number=case_no,
        title=f"United States v. {last}",
        category=scenario["cat"],
        difficulty=scenario["diff"],
        charges=scenario["charges"],
        synopsis=scenario["synopsis"] + f" Today's defendant: {first} {last}.",
        is_daily=True,
        hero_image=hero,
        evidence=evidence,
        witnesses=witnesses,
        clues=clues,
        judge=judge,
    )

@api.get("/cases/daily", response_model=Case)
async def get_daily_case():
    day = date.today().isoformat()
    cached = await db.cases.find_one({"id": f"daily-{day}"}, {"_id": 0})
    if cached:
        return Case(**cached)
    c = _build_daily_case(day)
    await db.cases.update_one({"id": c.id}, {"$set": c.model_dump()}, upsert=True)
    return c

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
