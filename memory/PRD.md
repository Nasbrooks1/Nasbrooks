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

## v1.2 additions (Sep 2026)
- **Witness Portraits** — `GET /api/witness/{case_id}/{witness_id}/portrait` uses Gemini Nano Banana (`gemini-3.1-flash-image-preview`) to lazy-generate a monochrome courtroom-sketch portrait per witness. Cached in the `portraits` MongoDB collection as a base64 data URL; frontend renders the portrait inside the courtroom speaker avatar.
- **Trial Highlight Reel** — `GET /api/replays/{id}/highlights` runs a heuristic scan of the saved transcript to score contradictions (100), objections sustained (80), evidence admissions (60), and always appends the final verdict (90). Returns the top 5. The replay detail screen renders a Highlight Reel section with color-coded cards; each card is individually shareable.
- **Daily Case** — `GET /api/cases/daily` builds a deterministic procedurally-blended case seeded from today's date (`sha256(YYYY-MM-DD)`), pulling from pools of defendant names, scenario templates (violent / financial / drug), witness archetypes, clues, hero images, and judges. First call generates and caches to `cases` collection; subsequent calls return the cached case. Main menu shows the daily card above the PLAY button.
- **Judge Personalities** — each seeded case (and each daily case) carries a `judge` object with `name`, `personality` (strict / lenient / by-the-book / tech-skeptic), `tagline`, and `sustain_bias` (-1.0 to +1.0). The `POST /api/objection/rule` endpoint now accepts an optional `case_id`, injects the judge's persona into the LLM system prompt, and applies a stochastic post-ruling bias flip weighted by the personality. The Case Brief screen shows the presiding judge; the courtroom opening avatar shows the judge subtitle.
