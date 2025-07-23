import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../components/context/AuthContext';
import CustomHeader from '../../components/navigation/CustomHeader';

const SettingsScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    sounds: true,
    biometricLogin: false,
    dataSync: true
  });

  const handleToggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await logout();
              // Navigation will be handled by AppNavigator based on auth state
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
              setIsLoading(false);
            }
          } 
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4B70FE" />
        <Text style={styles.loadingText}>Logging out...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader title="Settings" showBackButton={true} />
      
      <ScrollView style={styles.content}>
        {/* General Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Notifications</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={() => handleToggleSetting('notifications')}
              trackColor={{ false: '#d0d0d0', true: '#4B70FE' }}
              thumbColor="#ffffff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Dark Mode</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={() => handleToggleSetting('darkMode')}
              trackColor={{ false: '#d0d0d0', true: '#4B70FE' }}
              thumbColor="#ffffff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Sound Effects</Text>
            </View>
            <Switch
              value={settings.sounds}
              onValueChange={() => handleToggleSetting('sounds')}
              trackColor={{ false: '#d0d0d0', true: '#4B70FE' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
        
        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="finger-print-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Biometric Login</Text>
            </View>
            <Switch
              value={settings.biometricLogin}
              onValueChange={() => handleToggleSetting('biometricLogin')}
              trackColor={{ false: '#d0d0d0', true: '#4B70FE' }}
              thumbColor="#ffffff"
            />
          </View>
          
          <TouchableOpacity style={styles.settingItemButton}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#c0c0c0" />
          </TouchableOpacity>
        </View>
        
        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="cloud-upload-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Auto Sync Data</Text>
            </View>
            <Switch
              value={settings.dataSync}
              onValueChange={() => handleToggleSetting('dataSync')}
              trackColor={{ false: '#d0d0d0', true: '#4B70FE' }}
              thumbColor="#ffffff"
            />
          </View>
          
          <TouchableOpacity style={styles.settingItemButton}>
            <View style={styles.settingInfo}>
              <Ionicons name="cloud-download-outline" size={22} color="#4B70FE" />
              <Text style={styles.settingTitle}>Backup & Restore</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#c0c0c0" />
          </TouchableOpacity>
        </View>
        
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={[styles.settingItemButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="log-out-outline" size={22} color="#FF5A5A" />
              <Text style={[styles.settingTitle, styles.logoutText]}>Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>MediMates v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#4B70FE',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4B70FE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  logoutButton: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#FF5A5A',
  },
  versionContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
});

export default SettingsScreen;
