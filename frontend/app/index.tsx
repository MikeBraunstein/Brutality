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
import { Audio } from 'expo-audio';
import * as KeepAwake from 'expo-keep-awake';

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
    moveTimeRemaining: 0
  });

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;

  // Audio refs
  const [musicSound, setMusicSound] = useState<Audio.Sound | null>(null);
  const [instructorVoice, setInstructorVoice] = useState<Audio.Sound | null>(null);

  // Move definitions
  const moves = {
    1: 'Left straight punch',
    2: 'Right straight punch', 
    3: 'Left hook',
    4: 'Right uppercut'
  };

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (musicSound) {
        musicSound.unloadAsync();
      }
      if (instructorVoice) {
        instructorVoice.unloadAsync();
      }
    };
  }, [musicSound, instructorVoice]);

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
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Audio permission is required for the workout');
        return;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      animateLogo();
      
      // Start workout
      setWorkoutState(prev => ({
        ...prev,
        isActive: true,
        currentRound: 1,
        timeRemaining: 300,
        complexityScore: 0.0,
        intensityScore: 0.0
      }));

      // Play welcome message and start workout
      await playWelcomeMessage();
      
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    }
  };

  const playWelcomeMessage = async () => {
    try {
      // This will be replaced with actual AI TTS
      console.log('Playing welcome message: "Welcome to Brutality, an exercise routine not for the faint of heart."');
      
      // Start background music (placeholder)
      // In real implementation, this would load techno house music
      console.log('Starting techno house background music');
      
      // Start first round after welcome
      setTimeout(() => {
        startRound(1);
      }, 3000);
      
    } catch (error) {
      console.error('Error playing welcome message:', error);
    }
  };

  const startRound = (roundNumber: number) => {
    console.log(`Starting round ${roundNumber}`);
    
    setWorkoutState(prev => ({
      ...prev,
      currentRound: roundNumber,
      timeRemaining: 300, // 5 minutes
      isBreak: false,
      complexityScore: 0.0,
      intensityScore: roundNumber === 1 ? 0.1 : prev.intensityScore + 0.1
    }));

    // Start calling moves
    setTimeout(() => {
      callNextMove();
    }, 1000);
  };

  const callNextMove = () => {
    const { complexityScore, intensityScore, currentRound } = workoutState;
    
    // Generate move based on complexity and intensity
    let moveCall = '';
    let moveDuration = 0;

    if (complexityScore === 0.0) {
      // Single number call
      const moveNumber = Math.floor(Math.random() * 4) + 1;
      moveCall = moveNumber.toString();
      moveDuration = moveNumber * 1000 + 1500; // Each move = 1 second + 1.5 second pause
    } else if (complexityScore <= 0.4) {
      // Defense + move combinations
      if (Math.random() < intensityScore) {
        const moveNumber = Math.floor(Math.random() * 4) + 1;
        moveCall = `Defense and ${moveNumber}`;
        moveDuration = 1500 + (moveNumber * 1000) + 1500; // Defense + moves + pause
      } else {
        const moveNumber = Math.floor(Math.random() * 4) + 1;
        moveCall = moveNumber.toString();
        moveDuration = moveNumber * 1000 + 1500;
      }
    } else {
      // Complex combinations and broken combos
      if (Math.random() < 0.5) {
        // Broken combo (call individual moves instead of numbers)
        const moves = ['Left straight', 'Right straight', 'Left hook', 'Right uppercut'];
        const combo = [];
        const numMoves = Math.floor(Math.random() * 3) + 2;
        
        if (Math.random() < intensityScore) {
          combo.push('Defense');
        }
        
        for (let i = 0; i < numMoves; i++) {
          combo.push(moves[Math.floor(Math.random() * moves.length)]);
        }
        
        moveCall = combo.join(', ');
        moveDuration = combo.length * 1500; // 1.5 seconds per move
      } else {
        // Regular combination
        const moveNumber = Math.floor(Math.random() * 4) + 1;
        if (Math.random() < intensityScore) {
          moveCall = `Defense and ${moveNumber}`;
          moveDuration = 1500 + (moveNumber * 1000) + 1500;
        } else {
          moveCall = moveNumber.toString();
          moveDuration = moveNumber * 1000 + 1500;
        }
      }
    }

    console.log(`Instructor calls: ${moveCall}`);
    
    setWorkoutState(prev => ({
      ...prev,
      currentMove: moveCall,
      moveTimeRemaining: moveDuration
    }));

    // Increase complexity gradually during round
    setTimeout(() => {
      setWorkoutState(prev => ({
        ...prev,
        complexityScore: Math.min(1.0, prev.complexityScore + 0.1)
      }));
    }, 30000); // Increase every 30 seconds

    // Schedule next move
    setTimeout(() => {
      if (workoutState.isActive && !workoutState.isBreak) {
        callNextMove();
      }
    }, moveDuration);
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