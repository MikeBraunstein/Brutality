import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Strip characters that TTS reads aloud as punctuation names.
 * "1-2-3" → "1 2 3"   "Defense, 1" → "Defense 1"
 */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[-]/g, ' ')
    .replace(/[,]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface SpeakOptions {
  text: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onDone?: () => void;
}

/**
 * Speak a workout callout using the device's native TTS engine (expo-speech).
 * On web, falls back to the browser Web Speech API.
 * Stops any currently speaking utterance before starting a new one.
 */
export async function speakCallout(options: SpeakOptions): Promise<void> {
  const { text, rate = 1.1, pitch = 0.75, onStart, onDone } = options;

  if (Platform.OS === 'web') {
    return _speakWeb(text, rate, pitch, onDone);
  }

  // Stop any ongoing utterance before starting the next
  await Speech.stop();

  return new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: 'en-US',
      rate,
      pitch,
      onStart: () => {
        onStart?.();
      },
      onDone: () => {
        onDone?.();
        resolve();
      },
      onError: () => {
        // Silent failure — never let TTS crash the workout
        onDone?.();
        resolve();
      },
    });
  });
}

export function stopSpeech(): void {
  Speech.stop();
}

function _speakWeb(
  text: string,
  rate: number,
  pitch: number,
  onDone?: () => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onDone?.();
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    utterance.onend = () => {
      onDone?.();
      resolve();
    };
    utterance.onerror = () => {
      onDone?.();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}
