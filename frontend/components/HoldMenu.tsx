import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MenuOption {
  id: string;
  title: string;
  icon: React.ReactNode;
  action: () => void;
  color: string;
}

interface HoldMenuProps {
  isVisible: boolean;
  onClose: () => void;
  isWorkoutActive: boolean;
  currentRound: number;
  onPause: () => void;
  onAdvanceRound: () => void;
  onRepeatRound: () => void;
  onSpotifyConnect: () => void;
  onSettings: () => void;
}

const HoldMenu: React.FC<HoldMenuProps> = ({
  isVisible,
  onClose,
  isWorkoutActive,
  currentRound,
  onPause,
  onAdvanceRound,
  onRepeatRound,
  onSpotifyConnect,
  onSettings,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  // Create menu options
  const menuOptions: MenuOption[] = [
    {
      id: 'settings',
      title: 'Settings',
      icon: <Ionicons name="settings" size={24} color="#FFFFFF" />,
      color: '#4A90E2',
      action: () => {
        runOnJS(onSettings)();
        runOnJS(onClose)();
      }
    },
    {
      id: 'spotify',
      title: 'Spotify',
      icon: <FontAwesome5 name="spotify" size={24} color="#FFFFFF" />,
      color: '#1DB954',
      action: () => {
        runOnJS(onSpotifyConnect)();
        runOnJS(onClose)();
      }
    },
    ...(isWorkoutActive ? [
      {
        id: 'pause',
        title: 'Pause',
        icon: <Ionicons name="pause-circle" size={24} color="#FFFFFF" />,
        color: '#FF6B35',
        action: () => {
          runOnJS(onPause)();
          runOnJS(onClose)();
        }
      },
      {
        id: 'advance',
        title: 'Next Round',
        icon: <MaterialIcons name="fast-forward" size={24} color="#FFFFFF" />,
        color: '#7ED321',
        action: () => {
          runOnJS(onAdvanceRound)();
          runOnJS(onClose)();
        }
      },
      {
        id: 'repeat',
        title: 'Repeat Round',
        icon: <MaterialIcons name="repeat" size={24} color="#FFFFFF" />,
        color: '#BD10E0',
        action: () => {
          runOnJS(onRepeatRound)();
          runOnJS(onClose)();
        }
      }
    ] : [])
  ];

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handleBackdropPress = () => {
    onClose();
  };

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        onPress={handleBackdropPress}
        activeOpacity={1}
      />
      
      <Animated.View style={[styles.menuContainer, containerStyle]}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Brutality Menu</Text>
          <Text style={styles.menuSubtitle}>
            {isWorkoutActive ? `Round ${currentRound}/7` : 'Ready to Train'}
          </Text>
        </View>

        <View style={styles.optionsGrid}>
          {menuOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.menuOption, { backgroundColor: option.color }]}
              onPress={option.action}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                {option.icon}
              </View>
              <Text style={styles.optionText}>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle" size={32} color="#FF6B35" />
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    width: screenWidth * 0.85,
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  menuSubtitle: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  menuOption: {
    width: screenWidth * 0.35,
    height: 80,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    marginBottom: 5,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
});

export default HoldMenu;
export type { MenuOption };