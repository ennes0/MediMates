import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PrimaryButton = ({
  title,
  onPress,
  style,
  textStyle,
  icon,
  iconRight = true,
  disabled = false,
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  // Force recreation of component when title changes or when component mounts
  React.useEffect(() => {
    // Reset scale when title changes to ensure proper rendering
    scale.setValue(1);
    
    // Force render to ensure button is visible
    // Use a more reliable approach with multiple refresh cycles
    const timeout1 = setTimeout(() => {
      scale.setValue(1.01);
      
      const timeout2 = setTimeout(() => {
        scale.setValue(1);
        
        // Add another refresh for reliability
        const timeout3 = setTimeout(() => {
          scale.setValue(1.001);
          setTimeout(() => scale.setValue(1), 10);
        }, 50);
        
        return () => clearTimeout(timeout3);
      }, 10);
      
      return () => clearTimeout(timeout2);
    }, 20);
    
    return () => clearTimeout(timeout1);
  }, [title, icon]);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}      style={[
        styles.button,
        style,
        { transform: [{ scale }], opacity: disabled ? 0.6 : 1 },
      ]}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
      disabled={disabled}
    >
      <View style={styles.contentContainer}>
        {icon && !iconRight && <Ionicons name={icon} size={20} color="#fff" style={styles.leftIcon} />}
        <Text style={[styles.text, textStyle]}>{title}</Text>
        {icon && iconRight && <Ionicons name={icon} size={20} color="#fff" style={styles.rightIcon} />}
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4B70FE',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4B70FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
    minHeight: 50,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
  },
});

export default PrimaryButton;
