import React, { useEffect, useState, useRef } from 'react';
import { View, Dimensions, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const centerX = screenWidth / 2;
const centerY = screenHeight / 2;

interface SpiralMenuItem {
  id: string;
  title: string;
  icon: string;
  action: () => void;
  color: string;
}

interface SpiralMenuProps {
  isVisible: boolean;
  onClose: () => void;
  items: SpiralMenuItem[];
}

// Logarithmic spiral parameters
const SPIRAL_GROWTH_RATE = 0.2; // Controls how quickly spiral expands
const SPIRAL_TURNS = 3; // Number of complete turns
const MIN_RADIUS = 60; // Minimum distance from center
const MAX_RADIUS = 180; // Maximum distance from center
const ITEM_SIZE_MIN = 30;
const ITEM_SIZE_MAX = 70;

// Calculate logarithmic spiral position
const calculateSpiralPosition = (
  t: number, // parameter from 0 to 1
  rotation: number = 0 // additional rotation in radians
) => {
  'worklet';
  
  // Logarithmic spiral: r = a * e^(b*θ)
  const theta = t * SPIRAL_TURNS * 2 * Math.PI + rotation;
  const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.pow(t, 1.5);
  
  return {
    x: centerX + r * Math.cos(theta),
    y: centerY + r * Math.sin(theta),
    radius: r,
    angle: theta,
  };
};

const SpiralMenu: React.FC<SpiralMenuProps> = ({ isVisible, onClose, items }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const itemPositions = useSharedValue<number[]>(items.map((_, i) => i / items.length));
  
  const [activeItems, setActiveItems] = useState<SpiralMenuItem[]>([]);
  const animationFrame = useRef<number>();

  // Initialize items when menu becomes visible
  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate menu appearance
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { 
        damping: 15, 
        stiffness: 150,
        mass: 1 
      });
      
      // Set initial items
      setActiveItems([...items]);
      
      // Initialize item positions along the spiral
      itemPositions.value = items.map((_, i) => {
        return withSpring(i / Math.max(items.length - 1, 1), {
          damping: 20,
          stiffness: 100,
        });
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
      setActiveItems([]);
    }
  }, [isVisible, items]);

  // Rotation gesture handler
  const rotationGesture = Gesture.Rotation()
    .onUpdate((event) => {
      // Update rotation and trigger haptic feedback
      const rotationDelta = event.rotation - rotation.value;
      rotation.value = event.rotation;
      
      // Adjust item positions based on rotation direction
      const direction = rotationDelta > 0 ? 1 : -1; // 1 for clockwise, -1 for counter-clockwise
      const speed = Math.abs(rotationDelta) * 2;
      
      itemPositions.value = itemPositions.value.map(pos => {
        const newPos = pos + (direction * speed * 0.01);
        return Math.max(0, Math.min(1, newPos));
      });
      
      // Haptic feedback for rotation
      if (Math.abs(rotationDelta) > 0.1) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onEnd(() => {
      // Smooth deceleration
      rotation.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
      });
    });

  // Pan gesture for closing menu
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      // Close menu if panned to center or with significant velocity
      const distance = Math.sqrt(event.translationX ** 2 + event.translationY ** 2);
      if (distance > 100 || Math.abs(event.velocityX) + Math.abs(event.velocityY) > 500) {
        runOnJS(onClose)();
      }
    });

  // Combined gestures
  const combinedGesture = Gesture.Simultaneous(rotationGesture, panGesture);

  // Animated container style
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value * 0.1}rad` }, // Subtle container rotation
    ],
  }));

  // Generate animated styles for each menu item
  const getItemAnimatedStyle = (index: number) => {
    return useAnimatedStyle(() => {
      const t = itemPositions.value[index] || 0;
      const position = calculateSpiralPosition(t, rotation.value * 0.05);
      
      // Calculate size based on distance from center
      const distanceFromCenter = Math.sqrt(
        Math.pow(position.x - centerX, 2) + Math.pow(position.y - centerY, 2)
      );
      
      const sizeProgress = interpolate(
        distanceFromCenter,
        [0, MAX_RADIUS],
        [0, 1],
        'clamp'
      );
      
      const size = interpolate(
        sizeProgress,
        [0, 1],
        [ITEM_SIZE_MIN, ITEM_SIZE_MAX]
      );
      
      // Calculate opacity - fade out as items approach center
      const opacityValue = interpolate(
        distanceFromCenter,
        [0, MIN_RADIUS],
        [0, 1],
        'clamp'
      );
      
      return {
        position: 'absolute' as const,
        left: position.x - size / 2,
        top: position.y - size / 2,
        width: size,
        height: size,
        opacity: opacityValue * opacity.value,
        transform: [
          { scale: sizeProgress },
          { rotate: `${position.angle + Math.PI / 2}rad` }, // Orient items along spiral
        ],
      };
    });
  };

  if (!isVisible) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
    }}>
      <GestureDetector gesture={combinedGesture}>
        <Animated.View
          style={[
            {
              flex: 1,
              width: '100%',
              height: '100%',
            },
            containerAnimatedStyle,
          ]}
        >
          {/* Spiral Trail Effect - Simple animated circles */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}>
            {[...Array(20)].map((_, i) => {
              const t = i / 19;
              const position = calculateSpiralPosition(t);
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: position.x - 2,
                    top: position.y - 2,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 107, 53, 0.3)',
                    opacity: opacity.value * 0.5,
                  }}
                />
              );
            })}
          </View>

          {/* Menu Items */}
          {activeItems.map((item, index) => (
            <Animated.View
              key={`${item.id}-${index}`}
              style={[
                {
                  borderRadius: 35,
                  backgroundColor: item.color,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 10,
                },
                getItemAnimatedStyle(index),
              ]}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: 'bold',
                textAlign: 'center',
              }}>
                {item.icon}
              </Text>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 8,
                fontWeight: '600',
                textAlign: 'center',
                marginTop: 2,
              }}>
                {item.title}
              </Text>
            </Animated.View>
          ))}

          {/* Center Indicator */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: centerX - 15,
                top: centerY - 15,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: 'rgba(255, 107, 53, 0.6)',
                borderWidth: 2,
                borderColor: '#FF6B35',
              },
              {
                transform: [{ scale: scale.value }],
              },
            ]}
          />

          {/* Instructions */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                bottom: 100,
                left: 20,
                right: 20,
                alignItems: 'center',
              },
              { opacity: opacity.value },
            ]}
          >
            <Text style={{
              color: '#FFFFFF',
              fontSize: 14,
              textAlign: 'center',
              opacity: 0.8,
            }}>
              Rotate clockwise ↻ to expand • Counter-clockwise ↺ to contract
            </Text>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 12,
              textAlign: 'center',
              opacity: 0.6,
              marginTop: 5,
            }}>
              Pan away from center to close
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default SpiralMenu;
export type { SpiralMenuItem };
