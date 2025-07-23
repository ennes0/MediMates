import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Animated, 
  Dimensions, 
  Pressable, 
  SafeAreaView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../components/context/AuthContext';
import { UserService } from '../../services/api';

const { width, height } = Dimensions.get('window');

const MusicSidebar = ({ visible, onClose, navigation }) => {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(visible ? 0 : -width)).current;
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const { user, token, logout } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Fetch user profile when sidebar becomes visible
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (visible && token && !userProfile) {
        setLoading(true);
        try {
          const response = await UserService.getProfile(token);
          if (response.success) {
            setUserProfile(response.data);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchUserProfile();
  }, [visible, token]);
  
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: visible ? 0 : -width,
        damping: 25,
        stiffness: 150,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start();
  }, [visible, slideAnim, fadeAnim]);
    return (
    <>
      {visible && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }, {zIndex: 9999}]}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={onClose} 
            testID="sidebar-overlay"
          />
        </Animated.View>
      )}      <Animated.View 
        style={[
          styles.container, 
          { 
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            zIndex: 10000
          }
        ]}
      >
        <BlurView intensity={95} tint="light" style={StyleSheet.absoluteFill} />
        
        <SafeAreaView style={styles.content}>          <View style={styles.header}>
            <View style={styles.logoContainer}>              <Image 
                source={require('../../assets/MediMates.png')} 
                style={styles.logo} 
                resizeMode="contain"
              />
              <Text style={styles.logoText}>MediMates</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
            {/* Profile Section */}          <View style={styles.profileSection}>
            <View style={styles.userAvatar}>
              {userProfile?.profilePicture ? (
                <Image 
                  source={{ uri: userProfile.profilePicture.startsWith('http') ? 
                    userProfile.profilePicture : 
                    `http://192.168.1.199:3000${userProfile.profilePicture}` 
                  }}
                  style={{ width: 46, height: 46, borderRadius: 23 }} 
                />
              ) : (
                <Ionicons name="person" size={36} color="#4A6AFF" />
              )}
            </View>
            <View style={styles.userInfo}>
              {loading ? (
                <ActivityIndicator size="small" color="#4A6AFF" />
              ) : (
                <>
                  <Text style={styles.userName}>{userProfile?.name || user?.name || "Welcome"}</Text>
                  <Text style={styles.userEmail}>{userProfile?.email || user?.email || "User"}</Text>
                </>
              )}
            </View>
          </View>
            <View style={styles.menuItems}>            {/* Profile Section */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                onClose();
                navigation.navigate('Profile');
              }}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="person-outline" size={20} color="#999" />
              </View>
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>
              {/* Friends Section */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                onClose();
                navigation.navigate('Friends');
              }}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="people-outline" size={20} color="#999" />
              </View>
              <Text style={styles.menuText}>Friends</Text>
            </TouchableOpacity>
            
            {/* Settings */}
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                onClose();
                navigation.navigate('Settings');
              }}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="settings-outline" size={20} color="#999" />
              </View>
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            {/* Help & Support */}
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={20} color="#999" />
              </View>
              <Text style={styles.menuText}>Help & Support</Text>
            </TouchableOpacity>
            
            {/* Logout */}
            <TouchableOpacity 
              style={[styles.menuItem, styles.logoutItem]}
              onPress={async () => {
                onClose();
                try {
                  await logout();
                  // Navigation will be handled by AppNavigator based on auth state
                } catch (error) {
                  console.error('Logout error:', error);
                }
              }}
            >
              <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
                <Ionicons name="log-out-outline" size={20} color="#999" />
              </View>
              <Text style={[styles.menuText, styles.logoutText]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 9999,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '75%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    position: 'relative',
  },  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A6AFF',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 15,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(74, 106, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  menuItems: {
    marginTop: 10,
  },  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  logoutItem: {
    marginTop: 16,
  },
  logoutIconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  logoutText: {
    color: '#999',
  },
});

export default MusicSidebar;
