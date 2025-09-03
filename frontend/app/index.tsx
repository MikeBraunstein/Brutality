import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  StatusBar,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrutalityAPI } from '../services/api';

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

export default function Index() {
  
  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    isActive: false,
    currentRound: 0,
    timeRemaining: 300, // 5 minutes
    isBreak: false,
    complexityScore: 0.0,
    intensityScore: 0.0,
    currentMove: '',
    moveTimeRemaining: 0,
    sessionId: null
  });

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;

  // Timer refs
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const moveTimer = useRef<NodeJS.Timeout | null>(null);

  // Move definitions
  const moves = {
    1: 'Left straight punch',
    2: 'Right straight punch', 
    3: 'Left hook',
    4: 'Right uppercut'
  };

  // Timer effect
  useEffect(() => {
    if (workoutState.isActive && workoutState.timeRemaining > 0) {
      workoutTimer.current = setTimeout(() => {
        setWorkoutState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1
        }));
      }, 1000);
    } else if (workoutState.isActive && workoutState.timeRemaining === 0) {
      // Round finished, start break or next round
      handleRoundComplete();
    }

    return () => {
      if (workoutTimer.current) {
        clearTimeout(workoutTimer.current);
      }
    };
  }, [workoutState.isActive, workoutState.timeRemaining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workoutTimer.current) {
        clearTimeout(workoutTimer.current);
      }
      if (moveTimer.current) {
        clearTimeout(moveTimer.current);
      }
    };
  }, []);

  const animateLogo = () => {
    // Scale animation
    Animated.sequence([
      Animated.timing(logoScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation
    Animated.sequence([
      Animated.timing(logoGlow, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(logoGlow, {
        toValue: 0,
        duration: 700,
        useNativeDriver: false,
      }),
    ]).start();

    // Shadow animation
    Animated.sequence([
      Animated.timing(shadowOpacity, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startWorkout = async () => {
    try {
      console.log('Starting workout...');

      // Start workout session with backend
      const session = await BrutalityAPI.startWorkoutSession('user_1');
      console.log('Workout session started:', session.id);

      animateLogo();
      
      // Start workout
      setWorkoutState(prev => ({
        ...prev,
        isActive: true,
        currentRound: 1,
        timeRemaining: 300,
        complexityScore: 0.0,
        intensityScore: 0.1,
        sessionId: session.id
      }));

      // Play welcome message and start workout
      await playWelcomeMessage();
      
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    }
  };

  const handleRoundComplete = () => {
    if (workoutState.currentRound >= 7) {
      // Workout complete
      completeWorkout();
    } else if (workoutState.isBreak) {
      // Break finished, start next round
      const nextRound = workoutState.currentRound + 1;
      setWorkoutState(prev => ({
        ...prev,
        currentRound: nextRound,
        timeRemaining: 300, // 5 minutes
        isBreak: false,
        complexityScore: 0.0,
        intensityScore: Math.min(1.0, prev.intensityScore + 0.1)
      }));
      startRound(nextRound);
    } else {
      // Round finished, start break
      setWorkoutState(prev => ({
        ...prev,
        timeRemaining: 180, // 3 minutes break
        isBreak: true,
        currentMove: 'Break time! Rest and hydrate.'
      }));
    }
  };

  const completeWorkout = async () => {
    try {
      if (workoutState.sessionId) {
        await BrutalityAPI.completeWorkoutSession(workoutState.sessionId);
      }
      
      setWorkoutState(prev => ({
        ...prev,
        isActive: false,
        currentMove: 'Workout Complete! Great job!'
      }));
      
      Alert.alert('Congratulations!', 'You have completed the Brutality workout!');
    } catch (error) {
      console.error('Error completing workout:', error);
    }
  };

  const playWelcomeMessage = async () => {
    try {
      const welcomeText = "Welcome to Brutality, an exercise routine not for the faint of heart.";
      console.log('Playing welcome message:', welcomeText);
      
      // Generate TTS for welcome message
      try {
        const ttsResponse = await BrutalityAPI.generateTTS({
          text: welcomeText,
          voice: 'onyx', // Deep male voice
          speed: 1.0
        });
        console.log('TTS generated successfully');
        // TODO: Play the audio from ttsResponse.audio_base64
      } catch (error) {
        console.error('TTS generation failed:', error);
      }
      
      // Start background music (placeholder)
      console.log('Starting techno house background music');
      
      // Start first round after welcome
      setTimeout(() => {
        startRound(1);
      }, 4000);
      
    } catch (error) {
      console.error('Error playing welcome message:', error);
    }
  };

  const startRound = (roundNumber: number) => {
    console.log(`Starting round ${roundNumber}`);
    
    // Start calling moves immediately
    setTimeout(() => {
      callNextMove();
    }, 2000);
  };

  const callNextMove = async () => {
    if (!workoutState.isActive || workoutState.isBreak) {
      return;
    }

    try {
      // Generate move command from backend
      const moveCommand = await BrutalityAPI.generateMoveCommand(
        workoutState.complexityScore,
        workoutState.intensityScore,
        workoutState.currentRound
      );

      console.log(`Instructor calls: ${moveCommand.command}`);
      
      // Generate TTS for the move command
      try {
        const ttsResponse = await BrutalityAPI.generateTTS({
          text: moveCommand.command,
          voice: 'onyx',
          speed: 1.2 // Slightly faster for commands
        });
        // TODO: Play the audio from ttsResponse.audio_base64
      } catch (error) {
        console.error('Move TTS generation failed:', error);
      }
      
      setWorkoutState(prev => ({
        ...prev,
        currentMove: moveCommand.command,
        moveTimeRemaining: moveCommand.duration_ms
      }));

      // Increase complexity gradually during round (every 30 seconds)
      if (workoutState.timeRemaining % 30 === 0) {
        setWorkoutState(prev => ({
          ...prev,
          complexityScore: Math.min(1.0, prev.complexityScore + 0.1)
        }));
      }

      // Schedule next move
      moveTimer.current = setTimeout(() => {
        callNextMove();
      }, moveCommand.duration_ms);

    } catch (error) {
      console.error('Error generating move command:', error);
      
      // Fallback to local move generation
      setTimeout(() => {
        callNextMove();
      }, 3000);
    }
  };

  const logoGlowColor = logoGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['#808080', '#FF6B35'] // Gray to orange
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.content}>
        {/* Workout Status */}
        {workoutState.isActive && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Round {workoutState.currentRound}/7
            </Text>
            <Text style={styles.timerText}>
              {Math.floor(workoutState.timeRemaining / 60)}:{(workoutState.timeRemaining % 60).toString().padStart(2, '0')}
            </Text>
            {workoutState.currentMove && (
              <Text style={styles.moveText}>
                {workoutState.currentMove}
              </Text>
            )}
          </View>
        )}

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.shadowContainer,
              {
                opacity: shadowOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.shadowCircle} />
          </Animated.View>
          
          <TouchableOpacity
            onPress={workoutState.isActive ? undefined : startWorkout}
            activeOpacity={0.8}
            disabled={workoutState.isActive}
          >
            <Animated.View
              style={[
                styles.logoCircle,
                {
                  backgroundColor: logoGlowColor,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Text style={styles.logoText}>B</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        {!workoutState.isActive && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Tap the logo to begin your Brutality workout
            </Text>
            <Text style={styles.instructionsSubtext}>
              7 rounds • 5 minutes each • 3 minute breaks
            </Text>
          </View>
        )}

        {/* Complexity & Intensity Indicators */}
        {workoutState.isActive && (
          <View style={styles.scoresContainer}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Complexity</Text>
              <View style={styles.scoreBar}>
                <View 
                  style={[
                    styles.scoreProgress, 
                    { width: `${workoutState.complexityScore * 100}%` }
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
                    { width: `${workoutState.intensityScore * 100}%` }
                  ]} 
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
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
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#808080',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
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