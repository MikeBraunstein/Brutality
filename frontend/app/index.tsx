import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { BrutalityAPI } from '../services/api';
import HoldMenu from '../components/HoldMenu';

const { width, height } = Dimensions.get('window');

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

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;

  // Timer refs
  const workoutTimer = useRef<any>(null);
  const moveTimer = useRef<any>(null);

  // Move definitions
  const moves: Record<number, string> = {
    1: 'Left straight punch',
    2: 'Right straight punch',
    3: 'Left hook',
    4: 'Right uppercut',
  };

  // Timer effect
  useEffect(() => {
    if (workoutState.isActive && workoutState.timeRemaining > 0 && !isPaused) {
      workoutTimer.current = setTimeout(() => {
        setWorkoutState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        }));
      }, 1000);
    } else if (workoutState.isActive && workoutState.timeRemaining === 0) {
      handleRoundComplete();
    }
    return () => {
      if (workoutTimer.current) clearTimeout(workoutTimer.current);
    };
  }, [workoutState.isActive, workoutState.timeRemaining, isPaused]);

  useEffect(() => {
    return () => {
      if (workoutTimer.current) clearTimeout(workoutTimer.current);
      if (moveTimer.current) clearTimeout(moveTimer.current);
    };
  }, []);

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
      console.log('Starting workout...');
      const session = await BrutalityAPI.startWorkoutSession('user_1');
      console.log('Workout session started:', session.id);

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

      await playWelcomeMessage();
    } catch (error) {
      console.error('Error starting workout:', error);
      // Fallback: start workout locally without backend
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
      setTimeout(() => startRound(1), 2000);
    }
  };

  const handleRoundComplete = () => {
    if (workoutState.currentRound >= 7) {
      completeWorkout();
    } else if (workoutState.isBreak) {
      const nextRound = workoutState.currentRound + 1;
      setWorkoutState(prev => ({
        ...prev,
        currentRound: nextRound,
        timeRemaining: 300,
        isBreak: false,
        complexityScore: 0.0,
        intensityScore: Math.min(1.0, prev.intensityScore + 0.1),
      }));
      startRound(nextRound);
    } else {
      setWorkoutState(prev => ({
        ...prev,
        timeRemaining: 180,
        isBreak: true,
        currentMove: 'Break time! Rest and hydrate.',
      }));
    }
  };

  const completeWorkout = async () => {
    try {
      if (workoutState.sessionId && workoutState.sessionId !== 'local-session') {
        await BrutalityAPI.completeWorkoutSession(workoutState.sessionId);
      }
      setWorkoutState(prev => ({
        ...prev,
        isActive: false,
        currentMove: 'Workout Complete! Great job!',
      }));
      setIsPaused(false);
      Alert.alert('Congratulations!', 'You have completed the Brutality workout!');
    } catch (error) {
      console.error('Error completing workout:', error);
    }
  };

  // Menu handlers
  const handlePause = () => {
    setIsPaused(p => !p);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (!isPaused) {
      setWorkoutState(prev => ({ ...prev, currentMove: 'Workout Paused' }));
    } else {
      setTimeout(() => callNextMove(), 1000);
    }
  };

  const handleAdvanceRound = () => {
    if (workoutState.currentRound < 7) {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const nextRound = workoutState.currentRound + 1;
      setWorkoutState(prev => ({
        ...prev,
        currentRound: nextRound,
        timeRemaining: 300,
        isBreak: false,
        complexityScore: 0.0,
        intensityScore: Math.min(1.0, prev.intensityScore + 0.1),
        currentMove: `Starting Round ${nextRound}...`,
      }));
      setIsPaused(false);
      setTimeout(() => startRound(nextRound), 2000);
    } else {
      Alert.alert('Final Round', 'You are already on the final round!');
    }
  };

  const handleRepeatRound = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setWorkoutState(prev => ({
      ...prev,
      timeRemaining: 300,
      isBreak: false,
      complexityScore: 0.0,
      currentMove: `Repeating Round ${prev.currentRound}...`,
    }));
    setIsPaused(false);
    setTimeout(() => startRound(workoutState.currentRound), 2000);
  };

  const handleSpotifyConnect = () => {
    Alert.alert(
      'Spotify Integration',
      'Spotify integration coming soon! Connect your account to stream workout music.',
      [{ text: 'OK' }]
    );
  };

  const handleSettings = () => {
    Alert.alert(
      'Settings',
      'Settings menu coming soon!\n\n• Workout preferences\n• Audio settings\n• Profile customization',
      [{ text: 'OK' }]
    );
  };

  const playWelcomeMessage = async () => {
    try {
      const welcomeText = 'Welcome to Brutality, an exercise routine not for the faint of heart.';
      console.log('Playing welcome message:', welcomeText);

      try {
        await BrutalityAPI.generateTTS({ text: welcomeText, voice: 'onyx', speed: 1.0 });
        console.log('TTS generated successfully');
      } catch (error) {
        console.error('TTS generation failed:', error);
      }

      setTimeout(() => startRound(1), 4000);
    } catch (error) {
      console.error('Error playing welcome message:', error);
    }
  };

  const startRound = (roundNumber: number) => {
    console.log(`Starting round ${roundNumber}`);
    setTimeout(() => callNextMove(), 2000);
  };

  const callNextMove = async () => {
    if (!workoutState.isActive || workoutState.isBreak) return;

    try {
      const moveCommand = await BrutalityAPI.generateMoveCommand(
        workoutState.complexityScore,
        workoutState.intensityScore,
        workoutState.currentRound
      );

      console.log(`Instructor calls: ${moveCommand.command}`);

      try {
        await BrutalityAPI.generateTTS({ text: moveCommand.command, voice: 'onyx', speed: 1.2 });
      } catch (error) {
        console.error('Move TTS generation failed:', error);
      }

      setWorkoutState(prev => ({
        ...prev,
        currentMove: moveCommand.command,
        moveTimeRemaining: moveCommand.duration_ms,
      }));

      if (workoutState.timeRemaining % 30 === 0) {
        setWorkoutState(prev => ({
          ...prev,
          complexityScore: Math.min(1.0, prev.complexityScore + 0.1),
        }));
      }

      moveTimer.current = setTimeout(() => callNextMove(), moveCommand.duration_ms);
    } catch (error) {
      console.error('Error generating move command:', error);
      // Fallback: generate a local move
      const localMoveNum = Math.floor(Math.random() * 4) + 1;
      setWorkoutState(prev => ({
        ...prev,
        currentMove: `${localMoveNum}`,
      }));
      moveTimer.current = setTimeout(() => callNextMove(), 3000);
    }
  };

  // ── Gesture handlers (MUST be inside the component) ──
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
      console.log('Long press completed - showing hold menu');
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
      if (!workoutState.isActive && !showHoldMenu) {
        console.log('Quick tap - starting workout');
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
        {/* Workout Status */}
        {workoutState.isActive && (
          <View style={styles.statusContainer} data-testid="workout-status">
            <Text style={styles.statusText}>
              Round {workoutState.currentRound}/7
            </Text>
            <Text style={styles.timerText}>
              {Math.floor(workoutState.timeRemaining / 60)}:
              {(workoutState.timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            {workoutState.currentMove ? (
              <Text style={styles.moveText}>{workoutState.currentMove}</Text>
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
              data-testid="logo-button"
              style={[
                styles.logoCircle,
                { backgroundColor: logoGlowColor, transform: [{ scale: logoScale }] },
              ]}
            >
              <Text style={styles.logoText}>B</Text>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Instructions */}
        {!workoutState.isActive && (
          <View style={styles.instructionsContainer} data-testid="instructions">
            <Text style={styles.instructionsText}>
              Tap the logo to begin your Brutality workout
            </Text>
            <Text style={styles.instructionsSubtext}>
              7 rounds • 5 minutes each • 3 minute breaks
            </Text>
            <Text style={styles.instructionsSubtext}>
              Hold logo for menu options
            </Text>
          </View>
        )}

        {/* Complexity & Intensity Indicators */}
        {workoutState.isActive && (
          <View style={styles.scoresContainer} data-testid="scores">
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Complexity</Text>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreProgress,
                    { width: `${workoutState.complexityScore * 100}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Intensity</Text>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreProgress,
                    { width: `${workoutState.intensityScore * 100}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Hold Menu */}
      <HoldMenu
        isVisible={showHoldMenu}
        onClose={() => setShowHoldMenu(false)}
        isWorkoutActive={workoutState.isActive}
        currentRound={workoutState.currentRound}
        onPause={handlePause}
        onAdvanceRound={handleAdvanceRound}
        onRepeatRound={handleRepeatRound}
        onSpotifyConnect={handleSpotifyConnect}
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
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timerText: {
    color: '#FF6B35',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  moveText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6B35',
    opacity: 0.3,
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
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionsSubtext: {
    color: '#808080',
    fontSize: 14,
    textAlign: 'center',
  },
  scoresContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    paddingHorizontal: 20,
  },
  scoreItem: {
    marginBottom: 15,
  },
  scoreLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 5,
  },
  scoreBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreProgress: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
});
