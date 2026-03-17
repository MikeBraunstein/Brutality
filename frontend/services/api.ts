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

/** Browser-native speech synthesis fallback */
const speakWithBrowser = (text: string, speed: number = 1.0): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.pitch = 0.8; // Deeper voice for "instructor" feel
    utterance.volume = 1.0;
    // Try to pick a deep male voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')
    );
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  }
};

export class BrutalityAPI {
  private static baseUrl = `${API_BASE_URL}/api`;

  static async generateTTS(request: TTSRequest): Promise<TTSResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) throw new Error(`TTS failed: ${response.statusText}`);

      const data: TTSResponse = await response.json();

      if (data.audio_base64 && data.audio_base64.length > 0) {
        // Play server-generated audio
        if (typeof window !== 'undefined') {
          const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
          audio.play().catch(() => {});
        }
      } else {
        // Fallback: use browser TTS
        speakWithBrowser(data.text, request.speed ?? 1.0);
      }

      return data;
    } catch (error) {
      // Even if the API fails, try browser TTS
      speakWithBrowser(request.text, request.speed ?? 1.0);
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
      const response = await fetch(
        `${this.baseUrl}/workout/move-command?complexity=${complexity}&intensity=${intensity}&round_number=${roundNumber}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error(`Move command failed: ${response.statusText}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) throw new Error(`Workout start failed: ${response.statusText}`);
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
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Workout completion failed: ${response.statusText}`);
    } catch (error) {
      console.error('Workout completion API error:', error);
      throw error;
    }
  }
}
