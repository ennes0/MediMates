import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import screens and navigators
import OnboardingScreen from '../../screens/onboarding/OnboardingScreen';
import AuthScreen from '../../screens/auth/AuthScreen';
import MainNavigator from './MainNavigator';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // For debugging
  useEffect(() => {
    console.log('Auth state changed:', { isLoading, user: user ? `User ID: ${user.id}` : null });
    
    // Once loading is complete, mark auth as ready
    if (!isLoading) {
      console.log('Authentication ready');
      setAuthReady(true);
    }
  }, [user, isLoading]);

  // Check if this is the first launch of the app
  useEffect(() => {
    // For now, temporarily set isFirstLaunch to false
    // This will be replaced with AsyncStorage logic once the package is properly installed
    setIsFirstLaunch(false);
  }, []);
  // Show loading screen while initializing
  if (!authReady || isFirstLaunch === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4B70FE" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
        initialRouteName={isFirstLaunch ? "Onboarding" : user ? "Main" : "Auth"}
      >
        {!user ? (
          // Auth Flow
          <>
            {isFirstLaunch && <Stack.Screen name="Onboarding" component={OnboardingScreen} />}
            <Stack.Screen name="Auth" component={AuthScreen} />
          </>
        ) : (
          // App Flow
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C24',
  },
});

export default AppNavigator;
