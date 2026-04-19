const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8001'}/api`;

export interface CalloutResponse {
  command: string;
  duration_ms: number;
  muscle_groups: string[];
}

export interface MuscleInfoResponse {
  move: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  description: string;
}

export interface HealthResponse {
  status: string;
  llm_ready: boolean;
  llm_backend: string;
}

/**
 * Fetch a workout callout from the backend LLM endpoint.
 * Rejects on network/HTTP error — caller should handle with fallback.
 */
export async function fetchLLMCallout(
  complexity: number,
  intensity: number,
  roundNumber: number,
  previousMove: string = '',
): Promise<CalloutResponse> {
  const res = await fetch(`${BASE}/llm/callout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      complexity,
      intensity,
      round_number: roundNumber,
      previous_move: previousMove,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM callout HTTP ${res.status}`);
  }

  return res.json() as Promise<CalloutResponse>;
}

/**
 * Fetch anatomical muscle info for a move in the background.
 * Never throws — returns null on any error.
 */
export async function fetchMuscleInfo(move: string): Promise<MuscleInfoResponse | null> {
  try {
    const res = await fetch(`${BASE}/llm/muscle-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<MuscleInfoResponse>;
  } catch {
    return null;
  }
}

/**
 * Fetch a conversational coaching tip for the rest break.
 * Never throws — returns null on any error.
 */
export async function fetchBreakTip(
  move: string,
  primaryMuscles: string[],
  roundNumber: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/llm/break-tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, primary_muscles: primaryMuscles, round_number: roundNumber }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { tip: string };
    return data.tip ?? null;
  } catch {
    return null;
  }
}

/**
 * Check backend health and LLM readiness.
 * Returns null if the backend is unreachable.
 */
export async function checkBackendHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${BASE}/health`, { method: 'GET' });
    if (!res.ok) return null;
    return res.json() as Promise<HealthResponse>;
  } catch {
    return null;
  }
}
