# Federal Trial — Cinematic Federal Courtroom Simulator

## MVP Scope
Single-player mobile game that lets the player pick a role (Prosecutor / Defense / Judge / Defendant / Agent / Jury), open a federal case file, investigate evidence, and play out a full trial ending in a jury verdict, sentencing and career XP.

## Core Flow
1. **Main Menu** – hero + 8 tiles (PLAY, CAREER MODE, QUICK TRIAL, CASE LIBRARY, CREATE CASE, CHARACTER, MULTIPLAYER, SETTINGS).
2. **Role Select** – horizontal carousel of 6 role portraits with duties + gold CTA.
3. **Case Library** – 8 category chips (All, Violent, Financial, Drug, Cyber, Corruption, Organized, High-Profile). 4 seeded cases including one clearly-labeled fictional celebrity-inspired case.
4. **Case Brief** – synopsis, charges, evidence & witness inventory.
5. **Investigation** – 6 folder actions (witnesses, phone records, surveillance, documents, financial, forensic) that unlock trial evidence.
6. **Courtroom** – speaker card + scrolling transcript + action bar (ASK, EVIDENCE, OBJECTION) + phase advance. Phases: opening → direct → cross → next witness → deliberation.
7. **Verdict** – JURY VERDICT (guilty/not guilty), per-charge findings, sentence, trial performance stats, XP earned, career auto-updated.

## AI
Claude Sonnet 4.6 via Emergent Universal Key (emergentintegrations) powers two endpoints:
- `POST /api/witness/respond` — in-character 1-3 sentence witness reply
- `POST /api/objection/rule` — sustained/overruled + FRE-grounded reasoning

Witness answers vary per question, respect persona and mood, and can flag contradictions.

## Backend (FastAPI + Mongo)
- `GET /api/cases[?category=]` — list seeded cases
- `GET /api/cases/{id}` — case detail
- `POST /api/witness/respond` — LLM witness
- `POST /api/objection/rule` — LLM judge ruling
- `POST /api/verdict` — deterministic score → guilty/not guilty per charge + sentence + XP
- `GET /api/career/{user_id}` / `POST /api/career/save` — level, xp, rank, completed cases

## Frontend (Expo Router)
- `(tabs)` — Play / Cases / Career / Profile with frosted glass tab bar
- `/role-select` — role carousel
- `/case/[id]` — brief
- `/case/[id]/investigation` — folder grid
- `/case/[id]/courtroom` — trial gameplay
- `/case/[id]/verdict` — verdict + sentencing + result stats

## Design
Glass / Luxe DARK per `/app/design_guidelines.json`: obsidian surfaces (#0A0B0E), antique gold accent (#D4AF37), Cormorant-style display (Georgia serif) + system sans for body, generous cinematic spacing, gradient-to-dark scrims, blurred bottom tab bar, blurred objection overlay with heavy haptic feedback.

## Not in MVP
Multiplayer, Create Case editor, extended Career branching, pass-and-play. All are visible entry points but non-functional stubs.

## v1.1 additions (Sep 2026)
- **Trial Replay** — every completed trial saves its full transcript + verdict via `POST /api/replays/save`; list in Profile → My Replays; individual `/replay/[id]` screen with Share (native Share sheet or web clipboard) and Delete.
- **Streaming Witnesses** — new `POST /api/witness/stream` SSE endpoint uses `LlmChat.stream_message` with Claude Sonnet 4.6; tokens appear word-by-word in the courtroom transcript, with a fallback to non-streaming + typewriter reveal.
- **Investigation Payoff** — each seeded case now includes `clues[]` where each clue is tied to an investigation action (witnesses, phone, surveillance, documents, financial, forensic) and carries a specific cross-exam question. Opened folders in Investigation surface those clues; the discovered clue IDs are passed to the courtroom, and their questions appear in the cross-exam sheet with a "FROM INVESTIGATION" badge.
- **Custom Questions** — the courtroom question sheet includes a multi-line TextInput + send button. Typed questions post to the transcript as counsel and stream a witness reply.
