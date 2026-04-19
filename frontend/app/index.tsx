import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { BrutalityAPI } from '../services/api';
import { speakCallout, stopSpeech, cleanForSpeech } from '../services/tts';
import { useMusicPlayer } from '../services/musicPlayer';
import { fetchLLMCallout, fetchMuscleInfo, fetchBreakTip, type MuscleInfoResponse } from '../services/llmApi';
import HoldMenu from '../components/HoldMenu';

const { width, height } = Dimensions.get('window');

// How many times in a row the same command is allowed before forcing a rotation
const MAX_REPEAT = 4;

interface WorkoutState {
  isActive: boolean;
  currentRound: number;
  timeRemaining: number;
  isBreak: boolean;
  complexityScore: number;
  intensityScore: number;
  currentMove: string;
  moveTimeRemaining: number;
  sessionId: string | null;
}

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
  if (Platform.OS !== 'web') {
    try { Haptics.impactAsync(style); } catch (_) {}
  }
};

export default function Index() {
  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    isActive: false,
    currentRound: 0,
    timeRemaining: 300,
    isBreak: false,
    complexityScore: 0.0,
    intensityScore: 0.0,
    currentMove: '',
    moveTimeRemaining: 0,
    sessionId: null,
  });

  const [showHoldMenu, setShowHoldMenu] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [muscleInfo, setMuscleInfo] = useState<MuscleInfoResponse | null>(null);

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;

  // Timer refs
  const workoutTimer = useRef<any>(null);
  const moveTimer = useRef<any>(null);

  // ── Stale-closure guards ─────────────────────────────────────────────────
  const workoutStateRef = useRef(workoutState);
  const isPausedRef = useRef(isPaused);
  const muscleInfoRef = useRef<MuscleInfoResponse | null>(null);
  const callNextMoveRef = useRef<() => void>(() => {});

  useEffect(() => { workoutStateRef.current = workoutState; });
  useEffect(() => { isPausedRef.current = isPaused; });

  // ── Recent-move deduplication ─────────────────────────────────────────────
  // Tracks the last 8 commands; refuses to schedule the same one >MAX_REPEAT times in a row
  const recentMovesRef = useRef<string[]>([]);

  function isOverused(cmd: string): boolean {
    const tail = recentMovesRef.current.slice(-MAX_REPEAT);
    return tail.length >= MAX_REPEAT && tail.every(c => c === cmd);
  }

  function recordMove(cmd: string): void {
    recentMovesRef.current = [...recentMovesRef.current.slice(-7), cmd];
  }

  function pickAlternative(avoid: string): string {
    const options = ['1', '2', '3', '4'].filter(d => d !== avoid.trim());
    return options[Math.floor(Math.random() * options.length)] ?? '1';
  }

  // Music player
  const { pickAndPlayMusic, duckMusic, unduckMusic, stopMusic, pauseMusic, resumeMusic, currentTrackName } = useMusicPlayer();

  // ── Workout timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (workoutState.isActive && workoutState.timeRemaining > 0 && !isPaused) {
      workoutTimer.current = setTimeout(() => {
        setWorkoutState(prev => ({ ...prev, timeRemaining: prev.timeRemaining - 1 }));
      }, 1000);
    } else if (workoutState.isActive && workoutState.timeRemaining === 0) {
      handleRoundComplete();
    }
    return () => { if (workoutTimer.current) clearTimeout(workoutTimer.current); };
  }, [workoutState.isActive, workoutState.timeRemaining, isPaused]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (workoutTimer.current) clearTimeout(workoutTimer.current);
      if (moveTimer.current) clearTimeout(moveTimer.current);
      stopSpeech();
      stopMusic();
    };
  }, []);

  // Keep callNextMoveRef pointing at the latest closure (runs every render)
  useEffect(() => { callNextMoveRef.current = callNextMove; });

  // ─────────────────────────────────────────────────────────────────────────
  // callNextMove — fire-and-forget, timer-driven
  // ─────────────────────────────────────────────────────────────────────────
  function callNextMove() {
    const state = workoutStateRef.current;
    if (!state.isActive || state.isBreak || isPausedRef.current) return;

    const { complexityScore, intensityScore, currentRound, currentMove } = state;

    Promise.race([
      fetchLLMCallout(complexityScore, intensityScore, currentRound, currentMove),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      ),
    ])
      .then(callout => {
        let cmd = callout.command;
        let dur = callout.duration_ms;

        // Prevent the same command from repeating MAX_REPEAT times in a row
        if (isOverused(cmd)) {
          cmd = pickAlternative(cmd);
          dur = (parseInt(cmd) || 2) * 1000 + 1500;
        }
        recordMove(cmd);
        scheduleMove(cmd, dur);
      })
      .catch(() => {
        // Network/timeout fallback: random local move
        const n = Math.floor(Math.random() * 4) + 1;
        const cmd = String(n);
        if (isOverused(cmd)) {
          const alt = pickAlternative(cmd);
          recordMove(alt);
          scheduleMove(alt, (parseInt(alt)) * 1000 + 1500);
        } else {
          recordMove(cmd);
          scheduleMove(cmd, n * 1000 + 1500);
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // scheduleMove — display + speak + queue next
  // ─────────────────────────────────────────────────────────────────────────
  function scheduleMove(command: string, duration_ms: number) {
    setWorkoutState(prev => ({ ...prev, currentMove: command, moveTimeRemaining: duration_ms }));
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    // Fetch muscle info in background; update both state and ref
    fetchMuscleInfo(command).then(info => {
      if (info) {
        setMuscleInfo(info);
        muscleInfoRef.current = info;
      }
    });

    // Speak using cleaned text (no dashes or commas)
    duckMusic();
    speakCallout({ text: cleanForSpeech(command), rate: 1.1, pitch: 0.75 });

    // Complexity progression every 30 seconds
    const state = workoutStateRef.current;
    if (state.timeRemaining % 30 === 0 && state.timeRemaining > 0) {
      setWorkoutState(prev => ({
        ...prev,
        complexityScore: Math.min(1.0, prev.complexityScore + 0.1),
      }));
    }

    // Queue next move after duration
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => {
      unduckMusic();
      callNextMoveRef.current();
    }, duration_ms);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // startBreak — announces rest, then speaks a conversational coaching tip
  // ─────────────────────────────────────────────────────────────────────────
  function startBreak(round: number, lastMove: string, lastInfo: MuscleInfoResponse | null) {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    stopSpeech();
    unduckMusic();

    setWorkoutState(prev => ({
      ...prev,
      timeRemaining: 180,
      isBreak: true,
      currentMove: 'Rest.',
    }));
    setMuscleInfo(null);

    // Fire-and-forget async coaching sequence during the break
    (async () => {
      duckMusic();

      // Announce the break
      await speakCallout({
        text: `Round ${round} complete. Good work. Rest for three minutes.`,
        rate: 0.9,
        pitch: 0.68,
      });

      // Coaching tip — only when the last move is a real command
      const skipWords = new Set(['rest.', 'paused', 'break time.', '']);
      if (lastMove && !skipWords.has(lastMove.toLowerCase())) {
        const tip = await fetchBreakTip(
          lastMove,
          lastInfo?.primary_muscles ?? [],
          round,
        );
        if (tip) {
          // Show tip on screen too
          setWorkoutState(prev => ({ ...prev, currentMove: tip }));
          await speakCallout({ text: tip, rate: 0.88, pitch: 0.65 });
        }
      }

      unduckMusic();
    })();
  }

  const animateLogo = () => {
    Animated.sequence([
      Animated.timing(logoScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(logoGlow, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(logoGlow, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]).start();
    Animated.sequence([
      Animated.timing(shadowOpacity, { toValue: 0.8, duration: 300, useNativeDriver: true }),
      Animated.timing(shadowOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  };

  const startWorkout = async () => {
    try {
      const session = await BrutalityAPI.startWorkoutSession('user_1');
      animateLogo();
      setWorkoutState(prev => ({
        ...prev,
        isActive: true,
        currentRound: 1,
        timeRemaining: 300,
        complexityScore: 0.0,
        intensityScore: 0.1,
        sessionId: session.id,
      }));
      recentMovesRef.current = [];
      await playWelcomeMessage();
    } catch {
      animateLogo();
      setWorkoutState(prev => ({
        ...prev,
        isActive: true,
        currentRound: 1,
        timeRemaining: 300,
        complexityScore: 0.0,
        intensityScore: 0.1,
        sessionId: 'local-session',
      }));
      recentMovesRef.current = [];
      setTimeout(() => startRound(1), 2000);
    }
  };

  const handleRoundComplete = () => {
    const state = workoutStateRef.current;

    if (state.currentRound >= 7) {
      completeWorkout();
    } else if (state.isBreak) {
      // Break over — start next round
      const nextRound = state.currentRound + 1;
      recentMovesRef.current = [];
      setWorkoutState(prev => ({
        ...prev,
        currentRound: nextRound,
        timeRemaining: 300,
        isBreak: false,
        complexityScore: 0.0,
        intensityScore: Math.min(1.0, prev.intensityScore + 0.1),
        currentMove: `Round ${nextRound}`,
      }));
      startRound(nextRound);
    } else {
      // Round over — start break with coaching
      startBreak(state.currentRound, state.currentMove, muscleInfoRef.current);
    }
  };

  const completeWorkout = async () => {
    if (moveTimer.current) clearTimeout(moveTimer.current);
    stopSpeech();
    try {
      if (workoutStateRef.current.sessionId !== 'local-session') {
        await BrutalityAPI.completeWorkoutSession(workoutStateRef.current.sessionId!);
      }
    } catch { /* non-critical */ }
    setWorkoutState(prev => ({ ...prev, isActive: false, currentMove: 'Workout complete.' }));
    setIsPaused(false);
    Alert.alert('Congratulations', 'You completed the Brutality workout.');
  };

  const handlePause = () => {
    const nowPaused = !isPausedRef.current;
    setIsPaused(nowPaused);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    if (nowPaused) {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      stopSpeech();
      unduckMusic();
      pauseMusic();
      setWorkoutState(prev => ({ ...prev, currentMove: 'Paused' }));
    } else {
      resumeMusic();
      setTimeout(() => callNextMoveRef.current(), 1000);
    }
  };

  const handleAdvanceRound = () => {
    const round = workoutStateRef.current.currentRound;
    if (round < 7) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      if (moveTimer.current) clearTimeout(moveTimer.current);
      stopSpeech();
      recentMovesRef.current = [];
      const nextRound = round + 1;
      setWorkoutState(prev => ({
        ...prev,
        currentRound: nextRound,
        timeRemaining: 300,
        isBreak: false,
        complexityScore: 0.0,
        intensityScore: Math.min(1.0, prev.intensityScore + 0.1),
        currentMove: `Round ${nextRound}`,
      }));
      setIsPaused(false);
      setTimeout(() => startRound(nextRound), 1500);
    } else {
      Alert.alert('Final Round', 'You are already on the final round.');
    }
  };

  const handleRepeatRound = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (moveTimer.current) clearTimeout(moveTimer.current);
    stopSpeech();
    recentMovesRef.current = [];
    const round = workoutStateRef.current.currentRound;
    setWorkoutState(prev => ({
      ...prev,
      timeRemaining: 300,
      isBreak: false,
      complexityScore: 0.0,
      currentMove: `Round ${round}`,
    }));
    setIsPaused(false);
    setTimeout(() => startRound(round), 1500);
  };

  const handleMusicPick = async () => {
    const track = await pickAndPlayMusic();
    if (track) triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSettings = () => {
    Alert.alert(
      'Settings',
      'Coming soon:\n• Voice speed & pitch\n• Round duration\n• Intensity preset',
      [{ text: 'OK' }]
    );
  };

  const playWelcomeMessage = async () => {
    duckMusic();
    await speakCallout({
      text: 'Welcome to Brutality. An exercise routine not for the faint of heart.',
      rate: 0.95,
      pitch: 0.7,
      onDone: unduckMusic,
    });
    setTimeout(() => startRound(1), 500);
  };

  const startRound = (roundNumber: number) => {
    setTimeout(() => callNextMoveRef.current(), 1500);
  };

  // ── Gesture handlers ──────────────────────────────────────────────────────
  const logoLongPress = Gesture.LongPress()
    .minDuration(1000)
    .onStart(() => {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      Animated.parallel([
        Animated.timing(logoScale, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(shadowOpacity, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
      ]).start();
    })
    .onEnd(() => {
      setShowHoldMenu(true);
      Animated.parallel([
        Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(shadowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    })
    .onFinalize(() => {
      Animated.parallel([
        Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(shadowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });

  const logoTap = Gesture.Tap()
    .maxDuration(999)
    .onEnd(() => {
      if (!workoutStateRef.current.isActive && !showHoldMenu) {
        startWorkout();
      }
    });

  const logoGlowColor = logoGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['#808080', '#FF6B35'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Workout status */}
        {workoutState.isActive && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>Round {workoutState.currentRound}/7</Text>
            <Text style={styles.timerText}>
              {Math.floor(workoutState.timeRemaining / 60)}:
              {(workoutState.timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            {workoutState.currentMove ? (
              <Text style={[
                styles.moveText,
                workoutState.isBreak && styles.moveTextBreak,
              ]}>
                {workoutState.currentMove}
              </Text>
            ) : null}
            {/* Primary muscles — shown during active moves only */}
            {muscleInfo && !workoutState.isBreak && (
              <Text style={styles.muscleText}>
                {muscleInfo.primary_muscles.join(' · ')}
              </Text>
            )}
            {currentTrackName ? (
              <Text style={styles.trackText}>♫ {currentTrackName}</Text>
            ) : null}
          </View>
        )}

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.shadowContainer,
              { opacity: shadowOpacity, transform: [{ scale: logoScale }] },
            ]}
          >
            <View style={styles.shadowCircle} />
          </Animated.View>

          <GestureDetector gesture={Gesture.Exclusive(logoLongPress, logoTap)}>
            <Animated.View
              style={[
                styles.logoCircle,
                { backgroundColor: logoGlowColor, transform: [{ scale: logoScale }] },
              ]}
            >
              <Text style={styles.logoText}>B</Text>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Pre-workout instructions */}
        {!workoutState.isActive && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>Tap to begin your Brutality workout</Text>
            <Text style={styles.instructionsSubtext}>7 rounds · 5 min each · 3 min breaks</Text>
            <Text style={styles.instructionsSubtext}>Hold logo for menu</Text>
            {currentTrackName ? (
              <Text style={styles.trackText}>♫ {currentTrackName}</Text>
            ) : null}
          </View>
        )}

        {/* Progress bars */}
        {workoutState.isActive && (
          <View style={styles.scoresContainer}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Complexity</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreProgress, { width: `${workoutState.complexityScore * 100}%` }]} />
              </View>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Intensity</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreProgress, { width: `${workoutState.intensityScore * 100}%` }]} />
              </View>
            </View>
          </View>
        )}
      </View>

      <HoldMenu
        isVisible={showHoldMenu}
        onClose={() => setShowHoldMenu(false)}
        isWorkoutActive={workoutState.isActive}
        isPaused={isPaused}
        currentRound={workoutState.currentRound}
        onPause={handlePause}
        onAdvanceRound={handleAdvanceRound}
        onRepeatRound={handleRepeatRound}
        onMusicPick={handleMusicPick}
        onSettings={handleSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  statusContainer: {
    position: 'absolute',
    top: 50,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statusText: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  timerText: {
    color: '#FF6B35',
    fontSize: 52,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 2,
  },
  moveText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  // Break coaching tip is smaller and dimmer — it's a longer sentence
  moveTextBreak: {
    fontSize: 15,
    fontWeight: '400',
    color: '#CCCCCC',
    lineHeight: 22,
  },
  muscleText: {
    color: '#FF6B35',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.55,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  trackText: {
    color: '#333333',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  shadowContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FF6B35',
    opacity: 0.2,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#808080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#000000',
    fontSize: 48,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    gap: 6,
  },
  instructionsText: {
    color: '#CCCCCC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  instructionsSubtext: {
    color: '#444444',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scoresContainer: {
    position: 'absolute',
    bottom: 44,
    width: '100%',
    paddingHorizontal: 20,
  },
  scoreItem: {
    marginBottom: 12,
  },
  scoreLabel: {
    color: '#444444',
    fontSize: 10,
    marginBottom: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  scoreBar: {
    height: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
    overflow: 'hidden',
  },
  scoreProgress: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 1,
  },
});
