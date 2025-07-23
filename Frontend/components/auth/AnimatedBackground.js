import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

const AnimatedBackground = () => {
  // Animation values for floating elements
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;
  const rotate1 = useRef(new Animated.Value(0)).current;
  const rotate2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Create floating animations for background elements
    const createFloatingAnimation = (value, duration, toValue) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: toValue,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Create rotation animations
    const createRotationAnimation = (value, duration) => {
      return Animated.loop(
        Animated.timing(value, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        })
      );
    };

    // Start all animations
    createFloatingAnimation(float1, 3000, 10).start();
    createFloatingAnimation(float2, 5000, -15).start();
    createFloatingAnimation(float3, 4000, 12).start();
    createRotationAnimation(rotate1, 12000).start();
    createRotationAnimation(rotate2, 9000).start();

    return () => {
      // Stop animations on unmount
      float1.stopAnimation();
      float2.stopAnimation();
      float3.stopAnimation();
      rotate1.stopAnimation();
      rotate2.stopAnimation();
    };
  }, []);

  // Interpolate rotation values
  const rotation1 = rotate1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotation2 = rotate2.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Decorative background elements */}
      <Animated.View
        style={[
          styles.floatingElement1,
          {
            transform: [
              { translateY: float1 },
              { rotate: rotation1 }
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.floatingElement2,
          {
            transform: [
              { translateY: float2 },
              { rotate: rotation2 }
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.floatingElement3,
          {
            transform: [{ translateY: float3 }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -2,
    overflow: 'hidden',
  },
  floatingElement1: {
    position: 'absolute',
    top: height * 0.35,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(75, 112, 254, 0.2)',
  },
  floatingElement2: {
    position: 'absolute',
    top: height * 0.5,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(43, 76, 250, 0.15)',
  },
  floatingElement3: {
    position: 'absolute',
    bottom: 100,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 94, 252, 0.1)',
  },
});

export default AnimatedBackground;
