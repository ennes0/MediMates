import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView, 
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthBackground from './AuthBackground';
import AnimatedBackground from '../../components/auth/AnimatedBackground';
import PrimaryButton from '../../components/ui/PrimaryButton';
import { useAuth } from '../../components/context/AuthContext';

const { width, height } = Dimensions.get('window');

const AuthScreen = ({ navigation }) => {
  const { login, register, error, isLoading, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  // References for animation and form navigation
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  
  // Handle keyboard appearance
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Animate content up when keyboard appears
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        // Animate content back down when keyboard hides
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);  // Show error if any
  useEffect(() => {
    if (error) {
      Alert.alert('Authentication Error', error);
      clearError();
    }
  }, [error, clearError]);
  
  // Log authentication activities for debugging
  useEffect(() => {
    console.log('AuthScreen useEffect - checking auth state');
  }, []);

  // Animation for mode switching
  useEffect(() => {
    // Animate the form transition when switching between login and signup
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        delay: 50,
      }),
    ]).start();
    
    // Clear form validation errors when switching modes
    setValidationErrors({});
  }, [isLogin]);

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    // Email validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email';
    }
    
    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    // Additional validation for signup
    if (!isLogin) {
      if (!name) {
        errors.name = 'Name is required';
      }
      
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };  const handleAuth = async () => {
    // Dismiss keyboard
    Keyboard.dismiss();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    if (isLogin) {
      try {
        // Login
        console.log('Attempting login...');
        const result = await login(email, password);
        console.log('Login result:', result);
          if (result && result.success) {
          console.log('Login successful, navigating to Main...');
          // Add a small delay before navigation to ensure state updates
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }, 500);
        } else {
          console.log('Login failed, staying on auth screen');
          // Show an alert if there's no error already handled in useEffect
          if (!error) {
            Alert.alert('Login Failed', 'Please check your email and password.');
          }
        }
      } catch (err) {
        console.error('Error in handleAuth:', err);
        Alert.alert('Login Error', err.message || 'An unexpected error occurred');
      }
    } else {
      // Register
      try {
        console.log('Attempting registration...');
        const success = await register(name, email, password);
        console.log('Registration result:', success);
        if (success) {
          // If successful registration, switch to login or auto-login
          Alert.alert(
            'Registration Successful',
            'Your account has been created. Please login with your credentials.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Clear sensitive information first
                  setPassword('');
                  setConfirmPassword('');
                  setValidationErrors({});
                  
                  // Use a more reliable approach for switching to login mode
                  // First complete current render cycle
                  requestAnimationFrame(() => {
                    setIsLogin(true);
                    
                    // Force UI refresh after state is updated
                    setTimeout(() => {
                      // This forces a refresh of the whole keyboardAvoidingView
                      setEmail(prevEmail => prevEmail);
                    }, 100);
                    
                    console.log('Transitioning to login screen after registration');
                  });
                },
              },
            ]
          );
        }
      } catch (err) {
        console.error('Error in registration:', err);
        Alert.alert('Registration Error', err.message || 'An unexpected error occurred');
      }
    }
  };  const toggleAuthMode = () => {
    // Reset form errors and animations first
    setValidationErrors({});
    
    // Use requestAnimationFrame to ensure state changes are batched properly
    requestAnimationFrame(() => {
      const newLoginState = !isLogin;
      setIsLogin(newLoginState);
      
      // Force a refresh of the UI after state change
      setTimeout(() => {
        // This triggers a rerender without changing visible state
        setEmail(prevEmail => prevEmail);
      }, 50);
    });
    
    // Reset fields when toggling
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setValidationErrors({});
    
    // Force a re-render cycle
    requestAnimationFrame(() => {
      console.log(`Switched to ${newLoginState ? 'login' : 'signup'} mode`);
    });
  };
  
  // Show loading indicator if authentication is in progress
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#1C1C24" barStyle="light-content" />
        <AuthBackground />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4B70FE" />
          <Text style={styles.loadingText}>{isLogin ? 'Logging in...' : 'Creating account...'}</Text>
        </View>
      </SafeAreaView>
    );
  }
    return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1C1C24" barStyle="light-content" />
      <AuthBackground />
      <AnimatedBackground />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          key={`auth-mode-${isLogin ? 'login' : 'signup'}`}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <Animated.View 
            style={[
              styles.contentContainer, 
              { 
                transform: [{ translateY: slideAnim }],
                opacity: fadeAnim
              }
            ]}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.headerContainer}>
                <Text style={styles.welcomeText}>
                  {isLogin ? 'Welcome Back!' : 'Join Us Today'}
                </Text>
                <Text style={styles.titleText}>
                  {isLogin ? 'Login' : 'Sign Up'}
                </Text>
              </View>
              
              <View style={styles.formContainer}>                {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <View style={[styles.inputContainer, validationErrors.name && styles.inputError]}>
                      <Ionicons name="person-outline" size={20} color="#fff" style={styles.leftIcon} />
                      <TextInput
                        ref={nameInputRef}
                        style={styles.input}
                        value={name}
                        onChangeText={(text) => {
                          setName(text);
                          if (validationErrors.name) {
                            setValidationErrors({...validationErrors, name: null});
                          }
                        }}
                        placeholder="Enter your name"
                        placeholderTextColor="#8AA0FF"
                        returnKeyType="next"
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                        blurOnSubmit={false}
                      />
                    </View>
                    {validationErrors.name && (
                      <Text style={styles.errorText}>{validationErrors.name}</Text>
                    )}
                  </View>
                )}
                  <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={[styles.inputContainer, validationErrors.email && styles.inputError]}>
                    <Ionicons name="mail-outline" size={20} color="#fff" style={styles.leftIcon} />
                    <TextInput
                      ref={emailInputRef}
                      style={styles.input}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (validationErrors.email) {
                          setValidationErrors({...validationErrors, email: null});
                        }
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="Enter your email"
                      placeholderTextColor="#8AA0FF"
                      returnKeyType="next"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  {validationErrors.email && (
                    <Text style={styles.errorText}>{validationErrors.email}</Text>
                  )}
                </View>
                  <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={[styles.inputContainer, validationErrors.password && styles.inputError]}>
                    <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.leftIcon} />
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (validationErrors.password) {
                          setValidationErrors({...validationErrors, password: null});
                        }
                      }}
                      secureTextEntry={!showPassword}
                      placeholder="Enter password"
                      placeholderTextColor="#8AA0FF"
                      returnKeyType={isLogin ? "done" : "next"}
                      onSubmitEditing={() => {
                        if (isLogin) {
                          Keyboard.dismiss();
                        } else {
                          confirmPasswordInputRef.current?.focus();
                        }
                      }}
                      blurOnSubmit={isLogin}
                    />
                    <TouchableOpacity 
                      style={styles.inputIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {validationErrors.password && (
                    <Text style={styles.errorText}>{validationErrors.password}</Text>
                  )}
                </View>
                  {!isLogin && (
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={[styles.inputContainer, validationErrors.confirmPassword && styles.inputError]}>
                      <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.leftIcon} />
                      <TextInput
                        ref={confirmPasswordInputRef}
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          if (validationErrors.confirmPassword) {
                            setValidationErrors({...validationErrors, confirmPassword: null});
                          }
                        }}
                        secureTextEntry={!showPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="#8AA0FF"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    {validationErrors.confirmPassword && (
                      <Text style={styles.errorText}>{validationErrors.confirmPassword}</Text>
                    )}
                  </View>
                )}
                
                {isLogin && (
                  <TouchableOpacity style={styles.forgotPasswordBtn}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}                <View style={styles.buttonContainer}>
                  {isLogin ? (
                    <React.Fragment key="login-buttons">
                      <PrimaryButton
                        title="Sign Up"
                        onPress={toggleAuthMode}
                        style={styles.signUpButton}
                        textStyle={styles.signUpButtonText}
                      />
                      
                      <PrimaryButton
                        title="Log In"
                        onPress={handleAuth}
                        icon="arrow-forward"
                        iconRight={true}
                        style={styles.loginButton}
                        textStyle={styles.loginButtonText}
                      />
                    </React.Fragment>
                  ) : (
                    <PrimaryButton
                      title="Create Account"
                      onPress={handleAuth}
                      icon="arrow-forward"
                      iconRight={true}
                      style={styles.signUpPageButton}
                      textStyle={styles.signUpPageButtonText}
                    />
                  )}
                </View>
                
                {!isLogin && (
                  <TouchableOpacity 
                    style={styles.alreadyMemberContainer}
                    onPress={toggleAuthMode}
                  >
                    <Text style={styles.alreadyMemberText}>I am already a member</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C24',
  },
  keyboardView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerContainer: {
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 22,
    color: '#D0D0FF',
    marginBottom: 12,
    fontWeight: '500',
  },
  titleText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    color: '#D0D0FF',
    marginBottom: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(75, 112, 254, 0.5)',
    backgroundColor: 'rgba(75, 112, 254, 0.15)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    height: 55,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
    height: 50,
  },
  inputIcon: {
    padding: 5,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    marginBottom: 30,
    paddingVertical: 5,
  },
  forgotPasswordText: {
    color: '#4B70FE',
    fontSize: 15,
    fontWeight: '600',
  },  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signUpButton: {
    backgroundColor: 'rgba(75, 112, 254, 0.15)',
    borderWidth: 1,
    borderColor: '#4B70FE',
    flex: 1,
    marginRight: 12,
    elevation: 0,
    shadowColor: 'transparent',
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#4B70FE',
    flex: 1,
    marginLeft: 12,
    shadowColor: '#4B70FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signUpPageButton: {
    backgroundColor: '#4B70FE',
    width: '100%',
    paddingVertical: 18,
    shadowColor: '#4B70FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  signUpPageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  alreadyMemberContainer: {
    alignItems: 'center',
    marginTop: 25,
    paddingVertical: 10,
  },  alreadyMemberText: {
    color: '#4B70FE',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF5A5A',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  inputError: {
    borderColor: '#FF5A5A',
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1C1C24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
});

export default AuthScreen;
