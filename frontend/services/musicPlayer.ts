import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { useRef, useCallback, useEffect, useState } from 'react';

export interface MusicTrack {
  uri: string;
  name: string;
}

const MUSIC_NORMAL_VOLUME = 0.7;
const MUSIC_DUCKED_VOLUME = 0.15;

/**
 * Hook that manages background music playback with audio ducking for TTS callouts.
 *
 * Usage:
 *   const { pickAndPlayMusic, duckMusic, unduckMusic, stopMusic, currentTrackName } = useMusicPlayer();
 *
 * Ducking flow:
 *   duckMusic()  → volume drops to 0.15 (call before speakCallout)
 *   unduckMusic() → volume returns to 0.7  (pass as onDone to speakCallout)
 */
export function useMusicPlayer() {
  const player = useAudioPlayer(null as any);
  const currentTrack = useRef<MusicTrack | null>(null);
  const isDucked = useRef(false);
  const [currentTrackName, setCurrentTrackName] = useState<string | null>(null);

  useEffect(() => {
    // Must be set before any audio plays so TTS and music can coexist on Android
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    } as any).catch(() => {
      // Non-critical — swallow on platforms that don't support all options
    });
  }, []);

  const pickAndPlayMusic = useCallback(async (): Promise<MusicTrack | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      copyToCacheDirectory: true,  // Needed on Android for content:// URIs
    });

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    const track: MusicTrack = { uri: asset.uri, name: asset.name };
    currentTrack.current = track;
    setCurrentTrackName(asset.name);

    player.replace({ uri: asset.uri });
    player.volume = MUSIC_NORMAL_VOLUME;
    player.loop = true;
    player.play();

    return track;
  }, [player]);

  const duckMusic = useCallback(() => {
    if (!currentTrack.current || isDucked.current) return;
    isDucked.current = true;
    player.volume = MUSIC_DUCKED_VOLUME;
  }, [player]);

  const unduckMusic = useCallback(() => {
    if (!currentTrack.current || !isDucked.current) return;
    isDucked.current = false;
    player.volume = MUSIC_NORMAL_VOLUME;
  }, [player]);

  const stopMusic = useCallback(() => {
    player.pause();
    currentTrack.current = null;
    setCurrentTrackName(null);
  }, [player]);

  const resumeMusic = useCallback(() => {
    if (currentTrack.current) {
      player.play();
    }
  }, [player]);

  const pauseMusic = useCallback(() => {
    player.pause();
  }, [player]);

  return {
    pickAndPlayMusic,
    duckMusic,
    unduckMusic,
    stopMusic,
    resumeMusic,
    pauseMusic,
    currentTrackName,
    hasTrack: currentTrack.current !== null,
  };
}
