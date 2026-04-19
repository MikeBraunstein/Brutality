import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ─── 60-30-10 palette ───────────────────────────────────────────────────────
// 60 %  Black  #000000  dominant background / overlay
// 30 %  Dark   #111111 / #1A1A1A  surfaces, cards, option tiles
// 10 %  Orange #FF6B35  accent — borders, icons, highlights only
// ────────────────────────────────────────────────────────────────────────────

const { width: screenWidth } = Dimensions.get('window');

interface MenuOption {
  id: string;
  title: string;
  iconName: string;
  iconFamily: 'ionicons' | 'material';
  action: () => void;
}

interface HoldMenuProps {
  isVisible: boolean;
  onClose: () => void;
  isWorkoutActive: boolean;
  isPaused: boolean;
  currentRound: number;
  onPause: () => void;
  onAdvanceRound: () => void;
  onRepeatRound: () => void;
  onMusicPick: () => void;
  onSettings: () => void;
}

const MenuIcon = ({ family, name }: { family: string; name: string }) => {
  if (family === 'material') {
    return <MaterialIcons name={name as any} size={22} color="#FF6B35" />;
  }
  return <Ionicons name={name as any} size={22} color="#FF6B35" />;
};

const HoldMenu: React.FC<HoldMenuProps> = ({
  isVisible,
  onClose,
  isWorkoutActive,
  isPaused,
  currentRound,
  onPause,
  onAdvanceRound,
  onRepeatRound,
  onMusicPick,
  onSettings,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  const menuOptions: MenuOption[] = [
    {
      id: 'settings',
      title: 'Settings',
      iconName: 'settings-outline',
      iconFamily: 'ionicons',
      action: () => { onSettings(); onClose(); },
    },
    {
      id: 'music',
      title: 'Music',
      iconName: 'musical-notes-outline',
      iconFamily: 'ionicons',
      action: () => { onMusicPick(); onClose(); },
    },
    ...(isWorkoutActive
      ? [
          {
            id: 'pause',
            title: isPaused ? 'Resume' : 'Pause',
            iconName: isPaused ? 'play-circle-outline' : 'pause-circle-outline',
            iconFamily: 'ionicons' as const,
            action: () => { onPause(); onClose(); },
          },
          {
            id: 'advance',
            title: 'Next Round',
            iconName: 'fast-forward',
            iconFamily: 'material' as const,
            action: () => { onAdvanceRound(); onClose(); },
          },
          {
            id: 'repeat',
            title: 'Repeat',
            iconName: 'repeat',
            iconFamily: 'material' as const,
            action: () => { onRepeatRound(); onClose(); },
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (isVisible) {
      if (Platform.OS !== 'web') {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
      }
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
    } else {
      opacity.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) });
      translateY.value = withTiming(16, { duration: 160 });
    }
  }, [isVisible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />

      <Animated.View style={[styles.menuContainer, containerStyle]}>
        {/* Header */}
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>BRUTALITY</Text>
          {isWorkoutActive && (
            <Text style={styles.menuSubtitle}>
              Round {currentRound} / 7{isPaused ? ' · Paused' : ''}
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Options */}
        <View style={styles.optionsGrid}>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.menuOption}
              onPress={option.action}
              activeOpacity={0.6}
            >
              <View style={styles.iconContainer}>
                <MenuIcon family={option.iconFamily} name={option.iconName} />
              </View>
              <Text style={styles.optionText}>{option.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Close */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.6}>
          <Text style={styles.closeText}>CLOSE</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // 60%: black overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
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
  // 30%: dark surface
  menuContainer: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 20,
    width: Math.min(screenWidth * 0.82, 360),
    borderWidth: 1,
    borderColor: '#FF6B35',  // 10%: orange accent border
  },
  menuHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  menuTitle: {
    color: '#FF6B35',          // 10%: orange accent for title
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 6,
  },
  menuSubtitle: {
    color: '#555555',
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    columnGap: 10,
    marginBottom: 20,
  },
  // 30%: dark option tiles — orange icon is the 10% accent
  menuOption: {
    width: '47%',
    height: 72,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222222',
  },
  iconContainer: {
    marginBottom: 6,
  },
  optionText: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  closeText: {
    color: '#FF6B35',          // 10%: orange accent
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
});

export default HoldMenu;
