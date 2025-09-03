const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

export interface TTSResponse {
  audio_base64: string;
  text: string;
  voice: string;
}

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

  static async generateTTS(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`TTS generation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('TTS API error:', error);
      throw error;
    }
  }

  static async generateMoveCommand(
    complexity: number = 0.0,
    intensity: number = 0.0,
    roundNumber: number = 1
  ): Promise<MoveCommand> {
    try {
      const response = await fetch(`${this.baseUrl}/workout/move-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          complexity,
          intensity,
          round_number: roundNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Move command generation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Move command API error:', error);
      throw error;
    }
  }

  static async startWorkoutSession(userId: string): Promise<WorkoutSession> {
    try {
      const response = await fetch(`${this.baseUrl}/workout/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error(`Workout session start failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Workout session API error:', error);
      throw error;
    }
  }

  static async completeWorkoutSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/workout/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Workout completion failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Workout completion API error:', error);
      throw error;
    }
  }
}