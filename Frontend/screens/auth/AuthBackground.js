import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const AuthBackground = () => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4B70FE', '#3B5EFC', '#2B4CFA']}
        style={styles.topLeftCorner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />
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
    zIndex: -1,
  },
  topLeftCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.9,
    height: height * 0.35,
    borderBottomRightRadius: height * 0.4,
  },
  circle1: {
    position: 'absolute',
    top: 60,
    right: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B5EFC',
    opacity: 0.8,
  },
  circle2: {
    position: 'absolute',
    top: 100,
    right: 70,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4B70FE',
    opacity: 0.5,
  },
  circle3: {
    position: 'absolute',
    top: 80,
    right: 120,
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#2B4CFA',
    opacity: 0.7,
  },
});

export default AuthBackground;
