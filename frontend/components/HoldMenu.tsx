import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

interface MenuOption {
  id: string;
  title: string;
  iconName: string;
  iconFamily: 'ionicons' | 'material' | 'fontawesome5';
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

const MenuIcon = ({ family, name }: { family: string; name: string }) => {
  if (family === 'material') return <MaterialIcons name={name as any} size={24} color="#FFFFFF" />;
  if (family === 'fontawesome5') return <FontAwesome5 name={name as any} size={24} color="#FFFFFF" />;
  return <Ionicons name={name as any} size={24} color="#FFFFFF" />;
};

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

  const menuOptions: MenuOption[] = [
    {
      id: 'settings',
      title: 'Settings',
      iconName: 'settings',
      iconFamily: 'ionicons',
      color: '#4A90E2',
      action: () => { onSettings(); onClose(); },
    },
    {
      id: 'spotify',
      title: 'Spotify',
      iconName: 'spotify',
      iconFamily: 'fontawesome5',
      color: '#1DB954',
      action: () => { onSpotifyConnect(); onClose(); },
    },
    ...(isWorkoutActive
      ? [
          {
            id: 'pause',
            title: 'Pause',
            iconName: 'pause-circle',
            iconFamily: 'ionicons' as const,
            color: '#FF6B35',
            action: () => { onPause(); onClose(); },
          },
          {
            id: 'advance',
            title: 'Next Round',
            iconName: 'fast-forward',
            iconFamily: 'material' as const,
            color: '#7ED321',
            action: () => { onAdvanceRound(); onClose(); },
          },
          {
            id: 'repeat',
            title: 'Repeat Round',
            iconName: 'repeat',
            iconFamily: 'material' as const,
            color: '#BD10E0',
            action: () => { onRepeatRound(); onClose(); },
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (isVisible) {
      if (Platform.OS !== 'web') {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
      }
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={styles.overlay} data-testid="hold-menu">
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
        data-testid="hold-menu-backdrop"
      />

      <Animated.View style={[styles.menuContainer, containerStyle]}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Brutality Menu</Text>
          <Text style={styles.menuSubtitle}>
            {isWorkoutActive ? `Round ${currentRound}/7` : 'Ready to Train'}
          </Text>
        </View>

        <View style={styles.optionsGrid}>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.menuOption, { backgroundColor: option.color }]}
              onPress={option.action}
              activeOpacity={0.8}
              data-testid={`menu-option-${option.id}`}
            >
              <View style={styles.iconContainer}>
                <MenuIcon family={option.iconFamily} name={option.iconName} />
              </View>
              <Text style={styles.optionText}>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
          data-testid="hold-menu-close"
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
    maxWidth: 160,
    height: 80,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
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
