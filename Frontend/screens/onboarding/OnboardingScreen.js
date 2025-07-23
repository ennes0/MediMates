import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions, 
  Image, 
  StatusBar,
  Animated 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
// Import directly to avoid potential circular dependencies
import ProgressLoader from '../../components/ui/ProgressLoader';

const { width, height } = Dimensions.get('window');

// Animation URLs for Lottie animations
const animationUrls = {
  welcome: 'https://assets9.lottiefiles.com/packages/lf20_tutvdkg0.json',
  medication: 'https://assets2.lottiefiles.com/packages/lf20_vPnn3K.json',
  reminder: 'https://assets8.lottiefiles.com/packages/lf20_q77jpyct.json',
};

const onboardingData = [
  {
    id: '1',
    title: 'Welcome to MediMates',
    description: 'Your personal medication reminder companion for better health management.',
    image: require('../../assets/onboarding/onboarding1.png'),
    color: '#1ACCE8', // Teal color
    animation: animationUrls.welcome,
    lottieStyle: { width: 250, height: 250 },
  },
  {
    id: '2',
    title: 'Track Your Medications',
    description: 'Easily manage your medication schedule and never miss a dose again.',
    image: require('../../assets/onboarding/onboarding2.png'),
    color: '#00A3FF', // Blue color
    animation: animationUrls.medication,
    lottieStyle: { width: 280, height: 280 },
  },
  {
    id: '3',
    title: 'Get Timely Reminders',
    description: 'Receive notifications when it\'s time to take your medications.',
    image: require('../../assets/onboarding/onboarding3.png'),
    color: '#00C6AE', // Turquoise color
    animation: animationUrls.reminder,
    lottieStyle: { width: 260, height: 260 },
  },
];

const OnboardingScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const animationRef = useRef([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Use this to prevent flashing during background color transitions
  const interpolatedBackgroundColor = scrollX.interpolate({
    inputRange: onboardingData.map((_, i) => i * width),
    outputRange: onboardingData.map(item => item.color),
    extrapolate: 'clamp',
  });
  
  useEffect(() => {
    // Reset to initial state before animating with improved values
    fadeAnim.setValue(0.3);
    scaleAnim.setValue(0.85);
    slideAnim.setValue(30);
    
    // When the index changes, play the animation if available with slight delay for better flow
    setTimeout(() => {
      if (animationRef.current && animationRef.current[currentIndex]) {
        animationRef.current[currentIndex].play();
      }
    }, 150);
    
    // Enhanced animation sequence with improved timing and easing
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 35,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const renderItem = ({ item, index }) => {
    // Wider input range to create smoother transitions
    const inputRange = [
      (index - 1.5) * width, // Expanded range
      index * width,
      (index + 1.5) * width  // Expanded range
    ];
    
    // Enhanced animated style calculations with better timing
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp'
    });
    
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [80, 0, 80],
      extrapolate: 'clamp'
    });
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp'
    });

    // Add image fade effect for better integration with background
    const imageFade = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp'
    });

    return (
      <View style={[styles.slide, { width }]}>
        {/* Remove StatusBar backgroundColor changes to prevent flashing */}
        <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
        
        <Animated.View 
          style={[
            styles.imageContainer,
            { 
              opacity, 
              transform: [{ translateY }, { scale }] 
            }
          ]}
        >
          <LottieView
            ref={animation => {
              animationRef.current[index] = animation;
            }}
            source={{ uri: item.animation }}
            autoPlay
            loop
            style={item.lottieStyle || { width: 250, height: 250 }}
          />
          
          <Animated.Image 
            source={item.image} 
            style={[
              styles.image, 
              { 
                opacity: imageFade,
                borderRadius: 20,
              }
            ]}
            resizeMode="contain"
          />
          {/* Add subtle fade overlay at the edges for better blending */}
          <Animated.View style={styles.imageFadeOverlay} />
        </Animated.View>
          
        <Animated.View 
          style={{ 
            opacity, 
            transform: [{ translateY: translateY }],
            width: width * 0.9,
          }}
        >
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  const handleNext = () => {
    // Smoother exit animations before changing slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentIndex < onboardingData.length - 1) {
        // More controlled scrolling to prevent flashes
        flatListRef.current.scrollToOffset({
          offset: (currentIndex + 1) * width,
          animated: true
        });
        setCurrentIndex(currentIndex + 1);
      } else {
        // Show loader before navigation
        setShowLoader(true);
        
        // Enhanced exit animation before navigating
        Animated.timing(fadeAnim, {
          toValue: 0.2,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            navigation.replace('Auth');
          }, 1500);
        });
      }
    });
  };

  const handleSkip = () => {
    // Show loader and animate out before navigating away with improved animation
    setShowLoader(true);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0.2,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 450,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Short delay to show the loader
      setTimeout(() => {
        navigation.replace('Auth');
      }, 1500);
    });
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { translateX: slideAnim }],
          backgroundColor: interpolatedBackgroundColor, // Use this for smoother background transitions
        }
      ]}
    >
      {/* Loader overlay */}
      <ProgressLoader visible={showLoader} color={onboardingData[currentIndex]?.color || '#00C6AE'} size={50} />
      
      <Animated.FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        scrollEventThrottle={8} // More responsive scrolling
        decelerationRate={0.85} // Better deceleration
        bounces={false}
        initialScrollIndex={0}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { 
            useNativeDriver: false,
            listener: (event) => {
              // Prevent any jumpy behavior with this listener
              const offsetX = event.nativeEvent.contentOffset.x;
              const newIndex = Math.round(offsetX / width);
              if (newIndex !== currentIndex && newIndex >= 0 && newIndex < onboardingData.length) {
                // Only update index when actually changed to a valid value
                setCurrentIndex(newIndex);
              }
            }
          }
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          if (index >= 0 && index < onboardingData.length) {
            setCurrentIndex(index);
          }
        }}
      />
      
      <View style={styles.indicatorContainer}>
        {onboardingData.map((_, idx) => {
          // Improved indicator animations with smoother transitions
          const inputRange = [
            (idx - 1) * width,
            idx * width,
            (idx + 1) * width
          ];
          
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1.3, 0.8],
            extrapolate: 'clamp'
          });
          
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp'
          });
          
          return (
            <Animated.View 
              key={idx} 
              style={[
                styles.indicator, 
                { 
                  backgroundColor: '#ffffff',
                  transform: [{ scale }],
                  opacity,
                }
              ]} 
            />
          );
        })}
      </View>
      
      <View style={styles.buttonContainer}>
        {currentIndex < onboardingData.length - 1 ? (
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            activeOpacity={0.7} // Better touch feedback
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
        
        <TouchableOpacity 
          style={[
            styles.nextButton, 
            { backgroundColor: currentIndex === onboardingData.length - 1 ? '#00C6AE' : '#ffffff' }
          ]} 
          onPress={handleNext}
          activeOpacity={0.8} // Better touch feedback
        >
          <Text style={[
            styles.nextText, 
            { color: currentIndex === onboardingData.length - 1 ? '#ffffff' : onboardingData[currentIndex].color }
          ]}>
            {currentIndex === onboardingData.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons 
            name={currentIndex === onboardingData.length - 1 ? "checkmark" : "arrow-forward"} 
            size={20} 
            color={currentIndex === onboardingData.length - 1 ? "#ffffff" : onboardingData[currentIndex].color} 
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Add a background transition duration to prevent flash
    transitionProperty: 'background-color',
    transitionDuration: '300ms',
  },
  slide: {
    height: height,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  imageContainer: {
    width: width * 0.9,
    height: height * 0.45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  image: {
    width: width * 0.85,
    height: height * 0.38,
    position: 'absolute',
    top: 0,
  },
  // New fade overlay style for images
  imageFadeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: 'transparent',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  title: {
    fontSize: 30, // Increased font size
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 25,
    opacity: 0.9,
    lineHeight: 26, // Increased line height for better readability
    letterSpacing: 0.3,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
  },
  indicator: {
    height: 10,
    width: 10, // Fixed width instead of animated
    borderRadius: 5,
    marginHorizontal: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 25,
  },
  skipButton: {
    padding: 15,
  },
  skipText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.9, // Increased opacity for better visibility
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nextText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;
