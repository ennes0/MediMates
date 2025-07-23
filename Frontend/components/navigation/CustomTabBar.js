import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const CustomTabBar = ({ state, descriptors, navigation, sidebarVisible }) => {
  const tabLabels = ['Home', 'Medications', 'Calendar', 'Chat'];
  const [isTabPressThrottled, setIsTabPressThrottled] = React.useState(false);// Use multiple animation values for different properties
  const [scaleValues] = React.useState(
    state.routes.map(() => new Animated.Value(0))
  );
  const [opacityValues] = React.useState(
    state.routes.map(() => new Animated.Value(0))
  );
  
  // Important: Don't return early to avoid hook execution issues
  React.useEffect(() => {
    // Cancel any ongoing animations
    state.routes.forEach((_, index) => {
      Animated.timing(scaleValues[index]).stop();
      Animated.timing(opacityValues[index]).stop();
    });
    
    // Immediately hide inactive tabs
    state.routes.forEach((_, index) => {
      if (index !== state.index) {
        // Set directly for better performance instead of animating to 0
        scaleValues[index].setValue(0);
        opacityValues[index].setValue(0);
      }
    });
    
    // Animate only the active tab with optimized settings
    Animated.parallel([
      Animated.timing(scaleValues[state.index], {
        toValue: 1,
        duration: 200,
        useNativeDriver: true, // Use native driver for transforms
      }),
      Animated.timing(opacityValues[state.index], {
        toValue: 1,
        duration: 150, 
        useNativeDriver: true, // Use native driver for opacity
      })
    ]).start();
  }, [state.index, scaleValues, opacityValues, state.routes]);

  // If sidebar is visible, render an empty View to maintain hook execution order
  if (sidebarVisible) {
    return <View style={{display: 'none'}} />;
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4B70FE', '#3B5EFC', '#2B4CFA']}
        style={styles.tabBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = tabLabels[index];          const onPress = () => {
            // Prevent rapid tab pressing that could cause animation jank
            if (isTabPressThrottled) return;
            
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              // Apply throttling to prevent rapid tab pressing
              setIsTabPressThrottled(true);
              
              // Navigate to the route
              navigation.navigate({ name: route.name, merge: true });
              
              // Reset throttle after animation should be complete
              setTimeout(() => {
                setIsTabPressThrottled(false);
              }, 300);
            }
          };// Define icons for each tab
          let iconName;          switch (index) {
            case 0:  // Home tab
              iconName = isFocused ? 'home' : 'home-outline';
              break;
            case 1:  // Medications tab
              iconName = isFocused ? 'medical' : 'medical-outline';
              break;
            case 2:  // Calendar tab
              iconName = isFocused ? 'calendar' : 'calendar-outline';
              break;
            case 3:  // Chat tab
              iconName = isFocused ? 'chatbubble' : 'chatbubble-outline';
              break;
            default:
              iconName = 'home-outline';
          }          // Use optimized animation values
          const scaleValue = scaleValues[index];
          const opacityValue = opacityValues[index];
          
          // Simplified animations with better performance
          const pillScale = scaleValue;
          const pillOpacity = opacityValue;
          const iconOpacity = isFocused ? 1 : 0.7; // Static value for better performance
          
          // Use opacity directly for better hardware acceleration
          const pillWidth = isFocused ? 80 : 40; // Static width instead of animated for better performance

          return (
            <TouchableOpacity
              key={index}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              <View style={styles.tabContainer}>                {/* Optimized animated pill background - only render for focused items */}
                {isFocused && (
                  <Animated.View
                    style={[
                      styles.activePill,
                      {
                        opacity: pillOpacity,
                        transform: [{ scale: pillScale }],
                        width: pillWidth,
                      }
                    ]}
                    renderToHardwareTextureAndroid={true} // Performance boost on Android
                  />
                )}
                
                {/* Tab content */}
                <View style={styles.tabContent}>                  <View
                    style={[
                      styles.iconContainer,
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={20}
                      color={isFocused ? "#4B70FE" : "rgba(255, 255, 255, 0.7)"}
                    />
                  </View>
                  {/* Only render label for focused tab */}
                  {isFocused && (
                    <Animated.Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.activeLabel,
                        { 
                          opacity: pillOpacity,
                          transform: [{ scale: scaleValue }],
                        }
                      ]}
                      renderToHardwareTextureAndroid={true} // Performance boost on Android
                    >
                      {label}
                    </Animated.Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 999,
  },  tabBar: {
    flexDirection: 'row',
    borderRadius: 35,
    elevation: 8, // Reduced elevation for better performance
    shadowColor: '#4B70FE',
    shadowOffset: { width: 0, height: 4 }, // Reduced shadow for better performance
    shadowOpacity: 0.2, // Reduced opacity for better performance
    shadowRadius: 8, // Simplified shadow
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    width: '100%',
    height: 70,
    alignItems: 'center',
    backfaceVisibility: 'hidden', // Performance optimization
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    height: '100%',
  },
  tabContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 2,
    height: 36, // Reduced height for better proportions 
    backfaceVisibility: 'hidden', // Performance optimization
  },
  iconContainer: {
    marginRight: 4,
    backfaceVisibility: 'hidden', // Performance optimization
  },activePill: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, // Reduced shadow for performance
    shadowOpacity: 0.1, // Reduced opacity for performance
    shadowRadius: 4, // Reduced for performance
    elevation: 4, // Reduced for better performance
    zIndex: 1,
    backfaceVisibility: 'hidden', // Performance optimization
  },
  activeLabel: {
    color: '#4B70FE',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
    width: 50, // Fixed width instead of maxWidth for better performance
  },
});

export default CustomTabBar;