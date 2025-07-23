import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../../services/api';

// Create Auth Context
export const AuthContext = createContext();

// Auth Context Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Check if user is logged in on app start
  useEffect(() => {
    const loadAuthState = async () => {
      try {
        // Load token and user data from AsyncStorage
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUserData = await AsyncStorage.getItem('userData');
        
        if (storedToken && storedUserData) {
          // Parse user data and set the states
          const userData = JSON.parse(storedUserData);
          setUser(userData);
          setToken(storedToken);
          console.log('Loaded authentication from storage:', { token: storedToken, user: userData });
        } else {
          console.log('No authentication data found in storage');
        }
      } catch (error) {
        console.error('Error loading authentication data:', error);
        setError('Failed to load authentication data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAuthState();
  }, []);
    // Login function
  const login = async (email, password) => {
    setError(null);
    setIsLoading(true);
    
    try {
      console.log('Attempting to login with:', email);
      const response = await AuthService.login(email, password);
      console.log('Login API response:', response);
        if (response.success) {
        const { user, token } = response.data;
        
        // Store user data in AsyncStorage for persistence
        try {
          await AsyncStorage.setItem('userToken', token);
          await AsyncStorage.setItem('userData', JSON.stringify(user));
          console.log('Authentication data stored in AsyncStorage');
        } catch (storageError) {
          console.error('Failed to store auth data:', storageError);
        }
        
        console.log('Login successful, setting user:', user);
        
        // Set these states for the current session
        setUser(user);
        setToken(token);
        
        // Return success before changing loading state
        const result = { success: true, user, token };
        
        // Small delay to ensure state updates properly
        setTimeout(() => {
          setIsLoading(false);
          console.log('Auth loading state set to false after login');
        }, 100);
        
        return result;
      } else {
        console.log('Login failed:', response.message);
        setError(response.message || 'Login failed');
        setIsLoading(false);
        return { success: false };
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      setIsLoading(false);
      return { success: false };
    }
  };

  // Register function
  const register = async (name, email, password) => {
    setError(null);
    setIsLoading(true);
    
    try {
      const response = await AuthService.register(name, email, password);
      
      if (response.success) {
        // If auto-login after registration is needed, call login here
        // Or just return success
        return true;
      } else {
        setError(response.message || 'Registration failed');
        return false;
      }
    } catch (error) {
      setError(error.message || 'Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  // Logout function
  const logout = async () => {
    setIsLoading(true);
    
    try {
      if (token) {
        // Call logout API
        await AuthService.logout(token);
      }
        // Clear AsyncStorage data
      try {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('refreshToken');
        console.log('Authentication data cleared from AsyncStorage');
      } catch (storageError) {
        console.error('Failed to clear auth data from storage:', storageError);
      }
      
      // Clear state
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if token is valid (can be expanded)
  const isTokenValid = () => {
    return !!token;
  };

  // Context value
  const authContext = {
    user,
    token,
    isLoading,
    error,
    login,
    register,
    logout,
    isTokenValid,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
