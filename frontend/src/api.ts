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
export type Case = {
  id: string;
  case_number: string;
  title: string;
  category: string;
  difficulty: string;
  charges: string[];
  synopsis: string;
  is_celebrity_inspired: boolean;
  hero_image?: string;
  evidence: Evidence[];
  witnesses: Witness[];
};

export const api = {
  listCases: (category?: string) =>
    request<Case[]>(`/cases${category && category !== "all" ? `?category=${category}` : ""}`),
  getCase: (id: string) => request<Case>(`/cases/${id}`),
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
  objectionRule: (body: { objection_type: string; question: string; context?: string }) =>
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
};
