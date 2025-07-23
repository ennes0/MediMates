import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  StatusBar, 
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import CustomHeader from '../../components/navigation/CustomHeader';
import { useAuth } from '../../components/context/AuthContext';
import { UserService } from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const ProfileScreen = ({ navigation }) => {
  const { user, token, logout } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);  const [editFields, setEditFields] = useState({
    name: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    // Emergency contact fields are commented out as they're not in the database yet
    // emergencyContactName: '',
    // emergencyContactPhone: ''
  });
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Gender options for selection
  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const [showGenderModal, setShowGenderModal] = useState(false);
  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!token) {
        setError('No authentication token available. Please log in again.');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching user profile with token:', token ? 'Valid token' : 'No token');
        const response = await UserService.getProfile(token);
        console.log('Profile response:', JSON.stringify(response, null, 2));
        
        // Handle different response formats more robustly
        let profileData = null;
        
        if (response) {
          if (response.success === true && response.data) {
            // Format: { success: true, data: { user data } }
            profileData = response.data;
          } else if (response.user) {
            // Format: { user: { user data } }
            profileData = response.user;
          } else if (response.data) {
            // Format: { data: { user data } }
            profileData = response.data; 
          } else if (response.name !== undefined) {
            // Response itself is the user data object
            profileData = response;
          }
          
          if (profileData) {
            console.log('Extracted profile data:', JSON.stringify(profileData, null, 2));
            setUserProfile(profileData);
              // Initialize edit fields with current profile data
            setEditFields({
              name: profileData.name || '',
              phoneNumber: profileData.phoneNumber || '',
              dateOfBirth: profileData.dateOfBirth || '',
              gender: profileData.gender || '',
              // Emergency contact fields removed as they're not in the database
            });
          } else {
            console.error('Could not extract profile data from response:', response);
            setError('Could not understand the server response format');
          }
        } else {
          console.error('No response received from server');
          setError('No response received from server');
        }
      } catch (error) {
        setError(error.message || 'An error occurred while loading profile');
        console.error('Profile fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [token]);
  // Convert date string to Date object for iOS date picker
  const getDateObject = () => {
    if (!editFields.dateOfBirth) return new Date();
    
    try {
      const [year, month, day] = editFields.dateOfBirth.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch (e) {
      console.error('Error parsing date:', e);
      return new Date();
    }
  };
  
  // Format date for display and storage
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Handle date picker visibility
  const toggleDatePicker = () => {
    // Show/hide the date picker modal
    setShowDatePicker(!showDatePicker);
  };
  // Function to handle profile picture upload
  const handleProfilePictureUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to grant permission to access your photos');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImageUri = result.assets[0].uri;
        console.log('Selected image URI:', selectedImageUri);
        
        // Start upload
        setUploadingImage(true);
        setError(null);
        
        try {
          console.log('Uploading profile picture...');
          const response = await UserService.uploadProfilePicture(token, selectedImageUri);
          console.log('Upload response:', response);
          
          // Handle different response formats
          let profilePicturePath = null;
          
          // Check all possible response formats
          if (response) {
            if (response.success && response.data && response.data.profilePicture) {
              profilePicturePath = response.data.profilePicture;
            } else if (response.profilePicture) {
              profilePicturePath = response.profilePicture;
            } else if (response.data && response.data.profilePicture) {
              profilePicturePath = response.data.profilePicture;
            } else if (typeof response === 'string') {
              // Some APIs might return just the URL as a string
              profilePicturePath = response;
            } else if (response.url) {
              profilePicturePath = response.url;
            } else if (response.path) {
              profilePicturePath = response.path;
            }
            
            if (profilePicturePath) {
              // Update the profile with the new image URL
              setUserProfile(prev => ({
                ...prev,
                profilePicture: profilePicturePath
              }));
              
              Alert.alert('Success', 'Profile picture updated successfully');
            } else {
              console.error('Unknown response format:', response);
              throw new Error('Could not determine profile picture path from response');
            }
          } else {
            throw new Error('No response received from server');
          }
        } catch (error) {
          Alert.alert('Error', error.message || 'An error occurred while uploading profile picture');
          console.error('Profile picture upload error:', error);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select profile picture');
      console.error('Image picker error:', error);
      setUploadingImage(false);
    }
  };
  // Function to save profile changes
  const saveProfileChanges = async () => {
    try {
      setUpdating(true);
      
      // Validate inputs
      if (editFields.name.trim() === '') {
        Alert.alert('Validation Error', 'Name cannot be empty');
        setUpdating(false);
        return;
      }
        // Create a payload with only the fields that have values
      // Note: Backend only supports these fields as per the database schema
      const payload = {
        name: editFields.name,
      };
      
      if (editFields.phoneNumber) payload.phoneNumber = editFields.phoneNumber;
      if (editFields.dateOfBirth) payload.dateOfBirth = editFields.dateOfBirth;
      if (editFields.gender) payload.gender = editFields.gender;
      // The database doesn't currently have emergency contact fields
      // Removed: emergencyContactName and emergencyContactPhone
      
      console.log('Updating profile with data:', payload);
      
      // Send updated profile data to API
      const response = await UserService.updateProfile(token, payload);
      console.log('Profile update response:', response);
      
      // Handle all possible response formats more robustly
      if (response) {
        let updatedData;
        
        if (response.success === true && response.data) {
          updatedData = response.data;
        } else if (response.user) {
          updatedData = response.user;
        } else if (response.data) {
          updatedData = response.data;
        } else if (response.name !== undefined) {
          // Response itself contains user data
          updatedData = response;
        }
        
        if (updatedData) {
          // Update local state with the response data
          setUserProfile(prev => ({
            ...prev,
            ...updatedData
          }));
            // Also update edit fields with the returned data to stay in sync
          setEditFields(prevFields => ({
            ...prevFields,
            name: updatedData.name || prevFields.name,
            phoneNumber: updatedData.phoneNumber || prevFields.phoneNumber,
            dateOfBirth: updatedData.dateOfBirth || prevFields.dateOfBirth,
            gender: updatedData.gender || prevFields.gender,
            // Emergency contact fields aren't in the database yet
          }));
          
          setEditing(false);
          Alert.alert('Success', 'Profile updated successfully');
        } else {
          console.error('Unknown response format:', response);
          Alert.alert('Error', 'Could not determine updated profile data from response');
        }
      } else {
        Alert.alert('Error', 'No response received from server');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'An error occurred while updating profile');
      console.error('Profile update error:', error);
    } finally {
      setUpdating(false);
    }
  };
  
  // Get user initials for avatar placeholder
  const getUserInitials = () => {
    if (!userProfile || !userProfile.name) return '?';
    
    return userProfile.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={styles.container}>        <StatusBar barStyle="dark-content" />
        <CustomHeader title="My Profile" navigation={navigation} />
        
        {loading && !userProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A6AFF" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#E74C3C" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.replace('Profile')}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView 
            behavior="padding"
            style={{ flex: 1 }}
            keyboardVerticalOffset={64}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient
                colors={['#4A6AFF', '#77ABFF']}
                style={styles.header}
              >
                <TouchableOpacity
                  style={styles.profileImageContainer}
                  onPress={handleProfilePictureUpload}
                  disabled={uploadingImage}
                >                  {uploadingImage ? (
                    <View style={styles.profileImagePlaceholder}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>                  ) : userProfile?.profilePicture ? (
                    <Image 
                      source={{ 
                        uri: userProfile.profilePicture.startsWith('http') ? 
                          userProfile.profilePicture : 
                          userProfile.profilePicture.startsWith('/') ?
                            `http://192.168.1.199:3000${userProfile.profilePicture}` :
                            `http://192.168.1.199:3000/${userProfile.profilePicture}`
                      }} 
                      style={styles.profileImage}
                      onError={(e) => {
                        console.log('Error loading image:', e.nativeEvent.error);
                        // If the image fails to load, update state to show initials instead
                        setUserProfile(prev => ({
                          ...prev,
                          profilePicture: null
                        }));
                      }}
                    />
                  ) : (
                    <View style={styles.profileImagePlaceholder}>
                      <Text style={styles.profileInitials}>{getUserInitials()}</Text>
                    </View>
                  )}
                  <View style={styles.cameraIconContainer}>
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                
                <Text style={styles.headerName}>
                  {userProfile?.name || 'User'}
                </Text>
                <Text style={styles.headerEmail}>
                  {userProfile?.email || ''}
                </Text>
              </LinearGradient>
              
              <View style={styles.profileInfoContainer}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-outline" size={20} color="#4A6AFF" />
                  <Text style={styles.sectionHeaderText}>Basic Information</Text>
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Full Name</Text>
                  {editing ? (
                    <TextInput
                      style={styles.profileInfoEditInput}
                      value={editFields.name}
                      onChangeText={(text) => setEditFields({...editFields, name: text})}
                      placeholder="Enter your full name"
                      placeholderTextColor="#A0A0A0"
                    />
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.name || 'Not set'}</Text>
                  )}
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Email Address</Text>
                  <Text style={styles.profileInfoValue}>{userProfile?.email || 'Not set'}</Text>
                  <Text style={styles.readOnlyBadge}>Read only</Text>
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Phone Number</Text>
                  {editing ? (
                    <TextInput
                      style={styles.profileInfoEditInput}
                      value={editFields.phoneNumber}
                      onChangeText={(text) => setEditFields({...editFields, phoneNumber: text})}
                      placeholder="Enter your phone number"
                      keyboardType="phone-pad"
                      placeholderTextColor="#A0A0A0"
                    />
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.phoneNumber || 'Not set'}</Text>
                  )}
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Date of Birth</Text>                  {editing ? (
                    <TouchableOpacity
                      style={styles.profileInfoEditInput}
                      onPress={toggleDatePicker}
                    >
                      <Text style={styles.datePickerText}>
                        {editFields.dateOfBirth || 'Select date of birth'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.dateOfBirth || 'Not set'}</Text>
                  )}
                </View>                {showDatePicker && (
                  <Modal 
                    transparent={true} 
                    animationType="slide"
                    visible={showDatePicker}
                  >
                    <View style={styles.datePickerModalOverlay}>
                      <View style={styles.datePickerContainer}>
                        <View style={styles.datePickerHeader}>
                          <Text style={styles.datePickerTitle}>Select Date of Birth</Text>
                          <TouchableOpacity 
                            onPress={() => setShowDatePicker(false)}
                            style={styles.datePickerCloseButton}
                          >
                            <Text style={styles.datePickerButtonText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* iOS-specific DateTimePicker */}
                        <DateTimePicker
                          value={getDateObject()}
                          onChange={(event, date) => {
                            if (date) {
                              setEditFields({
                                ...editFields,
                                dateOfBirth: formatDate(date)
                              });
                            }
                          }}
                          mode="date"
                          display="spinner"
                          maximumDate={new Date()}
                          textColor="#000000"
                          themeVariant="light"
                        />
                        
                        <TouchableOpacity 
                          style={styles.datePickerConfirmButton}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.datePickerConfirmText}>Confirm</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Gender</Text>
                  {editing ? (
                    <TouchableOpacity
                      style={styles.profileInfoEditInput}
                      onPress={() => setShowGenderModal(true)}
                    >
                      <Text style={
                        editFields.gender ? styles.datePickerText : styles.datePickerPlaceholder
                      }>
                        {editFields.gender || 'Select gender'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.gender || 'Not set'}</Text>
                  )}
                </View>
                  {/* Emergency Contact section is hidden until database support is added */}
                {/* 
                <View style={styles.sectionHeader}>
                  <Ionicons name="alert-circle-outline" size={20} color="#4A6AFF" />
                  <Text style={styles.sectionHeaderText}>Emergency Contact</Text>
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Contact Name</Text>
                  {editing ? (
                    <TextInput
                      style={styles.profileInfoEditInput}
                      value={editFields.emergencyContactName}
                      onChangeText={(text) => setEditFields({...editFields, emergencyContactName: text})}
                      placeholder="Enter emergency contact name"
                      placeholderTextColor="#A0A0A0"
                    />
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.emergencyContactName || 'Not set'}</Text>
                  )}
                </View>
                
                <View style={styles.profileInfo}>
                  <Text style={styles.profileInfoLabel}>Contact Phone</Text>
                  {editing ? (
                    <TextInput
                      style={styles.profileInfoEditInput}
                      value={editFields.emergencyContactPhone}
                      onChangeText={(text) => setEditFields({...editFields, emergencyContactPhone: text})}
                      placeholder="Enter emergency contact phone"
                      keyboardType="phone-pad"
                      placeholderTextColor="#A0A0A0"
                    />
                  ) : (
                    <Text style={styles.profileInfoValue}>{userProfile?.emergencyContactPhone || 'Not set'}</Text>
                  )}
                </View>
                */}
              </View>
                <View style={[
                styles.actionButtonsContainer, 
                { flexDirection: editing ? 'column' : 'row' }
              ]}>
                {editing ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={saveProfileChanges}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => setEditing(false)}
                      disabled={updating}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => setEditing(true)}
                  >
                    <Ionicons name="pencil" size={18} color="#4A6AFF" />
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={() => setLogoutConfirmVisible(true)}
              >
                <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
                <Text style={styles.logoutButtonText}>Log Out</Text>
              </TouchableOpacity>
              
              <Text style={styles.versionText}>MediMates - Version 1.0.0</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
        
        {/* Gender Selection Modal */}
        <Modal
          visible={showGenderModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowGenderModal(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowGenderModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Select Gender</Text>
                {genderOptions.map((option, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={[
                      styles.genderOption,
                      editFields.gender === option && styles.selectedGenderOption
                    ]}
                    onPress={() => {
                      setEditFields({...editFields, gender: option});
                      setShowGenderModal(false);
                    }}
                  >
                    <Text style={[
                      styles.genderOptionText,
                      editFields.gender === option && styles.selectedGenderOptionText
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity 
                  style={styles.closeModalButton}
                  onPress={() => setShowGenderModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        
        {/* Logout Confirmation Modal */}
        <Modal
          visible={logoutConfirmVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setLogoutConfirmVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setLogoutConfirmVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.logoutModalContainer}>
                <Text style={styles.logoutModalTitle}>Log Out</Text>
                <Text style={styles.logoutModalMessage}>
                  Are you sure you want to log out of MediMates?
                </Text>
                <View style={styles.logoutModalButtons}>
                  <TouchableOpacity 
                    style={styles.logoutModalCancelButton}
                    onPress={() => setLogoutConfirmVisible(false)}
                  >
                    <Text style={styles.logoutModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.logoutModalConfirmButton}
                    onPress={() => {
                      setLogoutConfirmVisible(false);
                      logout();
                    }}
                  >
                    <Text style={styles.logoutModalConfirmText}>Log Out</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#4A6AFF',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A6AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    padding: 24,
  },
  profileImageContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInitials: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4A6AFF',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  profileInfoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: -20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A6AFF',
    marginLeft: 8,
  },
  profileInfo: {
    marginBottom: 20,
    position: 'relative',
  },
  profileInfoLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 6,
  },
  profileInfoValue: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  profileInfoEditInput: {
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
  },
  datePickerText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  datePickerPlaceholder: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  readOnlyBadge: {
    position: 'absolute',
    right: 0,
    top: 4,
    fontSize: 12,
    color: '#95A5A6',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },  actionButtonsContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    justifyContent: 'center',
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  editButton: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  editButtonText: {
    color: '#4A6AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#4A6AFF',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#7F8C8D',
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  logoutButtonText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#95A5A6',
    marginTop: 24,
    marginBottom: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 20,
  },
  genderOption: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  genderOptionText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  selectedGenderOption: {
    backgroundColor: '#F0F5FF',
  },
  selectedGenderOptionText: {
    color: '#4A6AFF',
    fontWeight: '500',
  },
  closeModalButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  closeModalButtonText: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  logoutModalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 16,
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 24,
    lineHeight: 22,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  logoutModalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  logoutModalCancelText: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  logoutModalConfirmButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },  logoutModalConfirmText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  datePickerCloseButton: {
    padding: 5,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#4A6AFF',
    fontWeight: '500',
  },
  datePickerConfirmButton: {
    backgroundColor: '#4A6AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  datePickerConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
