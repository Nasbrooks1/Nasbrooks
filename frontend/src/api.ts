// Thin API client. Base URL comes from EXPO_PUBLIC_BACKEND_URL.
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export type Evidence = { id: string; label: string; kind: string; summary: string };
export type Witness = { id: string; name: string; role: string; persona: string; key_facts: string[] };
export type Clue = { id: string; action: string; label: string; unlocks_question: string };
export type Judge = { name: string; personality: string; tagline: string; sustain_bias: number };
export type Case = {
  id: string;
  case_number: string;
  title: string;
  category: string;
  difficulty: string;
  charges: string[];
  synopsis: string;
  is_celebrity_inspired: boolean;
  is_daily?: boolean;
  hero_image?: string;
  evidence: Evidence[];
  witnesses: Witness[];
  clues: Clue[];
  judge?: Judge;
};

export type Highlight = {
  kind: "contradiction" | "objection_sustained" | "objection_overruled" | "evidence" | "verdict";
  speaker: string;
  text: string;
  score: number;
};

export type TranscriptLine = { speaker: string; role: string; text: string };
export type Replay = {
  id: string;
  user_id: string;
  case_id: string;
  case_title: string;
  role: string;
  verdict: string;
  per_charge: Record<string, string>;
  sentence: string | null;
  xp_earned: number;
  transcript: TranscriptLine[];
  stats: Record<string, number>;
  created_at: string;
};

export const api = {
  listCases: (category?: string) =>
    request<Case[]>(`/cases${category && category !== "all" ? `?category=${category}` : ""}`),
  getCase: (id: string) => request<Case>(`/cases/${id}`),
  getDailyCase: () => request<Case>(`/cases/daily`),
  getWitnessPortrait: (case_id: string, witness_id: string) =>
    request<{ data_url: string; cached: boolean }>(`/witness/${case_id}/${witness_id}/portrait`),
  getReplayHighlights: (replay_id: string) =>
    request<Highlight[]>(`/replays/${replay_id}/highlights`),
  witnessRespond: (body: {
    case_id: string;
    witness_id: string;
    question: string;
    is_cross_examination: boolean;
    mood: string;
  }) =>
    request<{ text: string; mood: string; contradicted: boolean }>(`/witness/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  objectionRule: (body: { objection_type: string; question: string; context?: string; case_id?: string }) =>
    request<{ ruling: "sustained" | "overruled"; reasoning: string }>(`/objection/rule`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  verdict: (body: {
    case_id: string;
    stats: {
      case_id: string;
      role: string;
      objections_won: number;
      objections_lost: number;
      evidence_introduced: number;
      witnesses_examined: number;
      contradictions_exposed: number;
      motions_granted: number;
      motions_denied: number;
    };
  }) =>
    request<{
      verdict: string;
      per_charge: Record<string, string>;
      summary: string;
      sentence: string | null;
      xp_earned: number;
    }>(`/verdict`, { method: "POST", body: JSON.stringify(body) }),
  getCareer: (user_id: string) =>
    request<{ user_id: string; level: number; xp: number; rank: string; role_focus: string; completed_cases: string[] }>(
      `/career/${user_id}`,
    ),
  saveCareer: (body: any) => request(`/career/save`, { method: "POST", body: JSON.stringify(body) }),

  saveReplay: (body: Omit<Replay, "id" | "created_at"> & { id?: string; created_at?: string }) =>
    request<Replay>(`/replays/save`, { method: "POST", body: JSON.stringify(body) }),
  listReplays: (user_id = "guest") => request<Replay[]>(`/replays?user_id=${user_id}`),
  getReplay: (id: string) => request<Replay>(`/replays/${id}`),
  deleteReplay: (id: string) => request(`/replays/${id}`, { method: "DELETE" }),

  // Streaming witness — reads SSE from /api/witness/stream and yields token chunks.
  witnessStream: async function* (body: {
    case_id: string;
    witness_id: string;
    question: string;
    is_cross_examination: boolean;
    mood: string;
  }): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${BASE}/api/witness/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) throw new Error(`Stream ${res.status}`);
    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n");
        const isDone = lines.some((l) => l.startsWith("event: done"));
        if (isDone) return;
        const dataLine = lines.find((l) => l.startsWith("data: "));
        if (dataLine) {
          const raw = dataLine.slice(6).replace(/\\n/g, "\n");
          if (raw) yield raw;
        }
      }
    }
  },
};
