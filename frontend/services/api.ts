const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8001';

export interface MoveCommand {
  command: string;
  complexity_score: number;
  intensity_score: number;
  duration_ms: number;
  round_number: number;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  start_time: string;
  rounds_completed: number;
  total_rounds: number;
  complexity_progression: number[];
  intensity_progression: number[];
}

export class BrutalityAPI {
  private static baseUrl = `${API_BASE_URL}/api`;

  static async generateMoveCommand(
    complexity: number = 0.0,
    intensity: number = 0.0,
    roundNumber: number = 1
  ): Promise<MoveCommand> {
    const response = await fetch(
      `${this.baseUrl}/workout/move-command?complexity=${complexity}&intensity=${intensity}&round_number=${roundNumber}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    if (!response.ok) throw new Error(`Move command failed: ${response.statusText}`);
    return response.json();
  }

  static async startWorkoutSession(userId: string): Promise<WorkoutSession> {
    const response = await fetch(`${this.baseUrl}/workout/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error(`Workout start failed: ${response.statusText}`);
    return response.json();
  }

  static async completeWorkoutSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workout/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Workout completion failed: ${response.statusText}`);
  }
}
