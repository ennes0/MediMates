import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar, 
  FlatList,
  SafeAreaView,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import MusicSidebar from '../../components/sidebar/MusicSidebar';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS,
  useAnimatedGestureHandler
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { useAuth } from '../../components/context/AuthContext';
import { MedicationService, ReminderService } from '../../services/api';
import { format, parse, addDays } from 'date-fns';

// Import medication icons
const MEDICATION_ICONS = {
  antibiotics: require('../../assets/icons/antibiotics.png'),
  antidepressant: require('../../assets/icons/antidep.png'),
  antihistamine: require('../../assets/icons/antihistamines.png'),
  contraceptive: require('../../assets/icons/contraceptive.png'),
  general: require('../../assets/icons/drugs.png'),
  hypertension: require('../../assets/icons/hypertension.png'),
  medicine: require('../../assets/icons/medicine.png'),
  spray: require('../../assets/icons/spray.png'),
  vaccine: require('../../assets/icons/vaccine.png'),
  vaccine2: require('../../assets/icons/vaccine2.png'),
};

// Generate week days for date selection
// Ayın tüm günlerini gösterecek şekilde güncellendi
const generateWeekDays = () => {
  const today = new Date();
  const weekDays = [];
  
  // Ayın gün sayısını hesapla
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Ayın ilk gününden son gününe kadar tüm günleri oluştur
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dayStr = format(date, 'EEE'); // abbreviated day name
    const dateStr = day.toString().padStart(2, '0'); // day of month, padded with leading zero if needed
    
    weekDays.push({
      day: dayStr,
      date: dateStr,
      fullDate: format(date, 'yyyy-MM-dd'),
      isSelected: day === today.getDate(), // Only today is selected by default
    });
  }
  
  return weekDays;
};

const mockMedicationData = {
  '08': [
    {
      id: '1',
      name: 'Atorvastatin',
      dosage: '20mg',
      frequency: 'Daily 2 times',
      time: '14:00 Pm',
      remainingCount: '20 capsule remain',
      iconType: 'medicine',
      reminderMedId: 'mock-1', // Add mock reminderMedId
    },
    {
      id: '2',
      name: 'Gabapentin',
      dosage: '25mg',
      frequency: 'Daily',
      time: '09:00 Am',
      remainingCount: '15 capsule remain',
      iconType: 'antidepressant',
      reminderMedId: 'mock-2', // Add mock reminderMedId
    }
  ],  '09': [
    {
      id: '3',
      name: 'Metformin',
      dosage: '500ml',
      frequency: 'Daily',
      time: '10:00 Am',
      remainingCount: '30 capsule remain',
      iconType: 'medicine',
      reminderMedId: 'mock-3', // Add mock reminderMedId
    },
    {
      id: '4',
      name: 'Vitamin D3',
      dosage: '1000IU',
      frequency: 'Once daily',
      time: '08:00 Am',
      remainingCount: '45 capsule remain',
      iconType: 'general',
      reminderMedId: 'mock-4', // Add mock reminderMedId
    }
  ],
  '10': [
    {
      id: '5',
      name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Every 8 hours',
      time: '12:00 Pm',
      remainingCount: '12 capsule remain',
      iconType: 'antibiotics',
    }
  ],
  '11': [
    {
      id: '6',
      name: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'As needed',
      time: '16:00 Pm',
      remainingCount: '25 tablet remain',
      iconType: 'medicine',
    },
    {
      id: '7',
      name: 'Aspirin',
      dosage: '81mg',
      frequency: 'Daily',
      time: '09:00 Am',
      remainingCount: '60 tablet remain',
      iconType: 'hypertension',
    }
  ],
  '12': [
    {
      id: '8',
      name: 'Insulin',
      dosage: '10 units',
      frequency: 'Before meals',
      time: '07:30 Am',
      remainingCount: '5 vials remain',
      iconType: 'vaccine',
    },
    {
      id: '9',
      name: 'Omeprazole',
      dosage: '20mg',
      frequency: 'Daily',
      time: '08:00 Am',
      remainingCount: '28 capsule remain',
      iconType: 'medicine',
    }
  ]
};

const HomeScreen = ({ navigation }) => {
  const { token, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'dd'));
  const [selectedFullDate, setSelectedFullDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [weekDaysState, setWeekDaysState] = useState(generateWeekDays());
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Animation values for the modal
  const translateY = useSharedValue(0);
  const SCREEN_HEIGHT = Dimensions.get('window').height;

  // Reset animation values when modal opens
  useEffect(() => {
    if (detailsModalVisible) {
      translateY.value = withSpring(0);
    }
  }, [detailsModalVisible]);
  
  // Create animated style for the modal
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }]
    };
  });

  // Handle gesture for sliding the modal down
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      // Only allow downward movement
      if (event.translationY > 0) {
        translateY.value = context.startY + event.translationY;
      }
    },
    onEnd: (event) => {
      // If the user pulled down far enough or with enough velocity, close the modal
      if (translateY.value > 150 || event.velocityY > 500) {
        runOnJS(setDetailsModalVisible)(false);
      } else {
        // Otherwise snap back to original position
        translateY.value = withSpring(0);
      }
    }
  });  const handleDateSelect = (date, fullDate, index) => {
    console.log(`Selecting date: ${date}, fullDate: ${fullDate}, index: ${index}`);
    
    // Güncellenen gün durumlarını ayarla
    const updatedWeekDays = weekDaysState.map((day, i) => ({
      ...day,
      isSelected: i === index
    }));
    
    setWeekDaysState(updatedWeekDays);
    setSelectedDate(date);
    setSelectedFullDate(fullDate);
  };  const renderWeekDay = ({ day, date, fullDate, isSelected }, index) => {
    // Bugün için özel işlem
    const isToday = fullDate === format(new Date(), 'yyyy-MM-dd');
    
    return (
      <TouchableOpacity 
        style={[styles.dayItem, isSelected && styles.selectedDayItem]}
        onPress={() => handleDateSelect(date, fullDate, index)}
      >
        <Text style={[styles.dayText, isSelected && styles.selectedText]}>{day}</Text>
        <Text style={[styles.dateText, isSelected && styles.selectedText]}>{date}</Text>
        {isToday && !isSelected && (
          <View style={{
            position: 'absolute',
            bottom: 15,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: '#4A6AFF'
          }} />
        )}
      </TouchableOpacity>
    );
  };// Helper function to safely get medication icon
  const getMedicationIcon = (iconType) => {
    // If the iconType exists in our MEDICATION_ICONS, return it
    if (iconType && MEDICATION_ICONS[iconType]) {
      return MEDICATION_ICONS[iconType];
    }
    
    // Otherwise, return a random icon from our available icons
    const iconKeys = Object.keys(MEDICATION_ICONS);
    const randomIcon = iconKeys[Math.floor(Math.random() * iconKeys.length)];
    return MEDICATION_ICONS[randomIcon];
  };  // Helper function to render different pill types
  const renderPillIcon = (pillType) => {
    console.log(`Rendering pill with type: ${pillType}`);
    
    // Default pill styling
    const containerStyle = { 
      width: 36, 
      height: 36, 
      alignItems: 'center',
      justifyContent: 'center'
    };
    
    const pillStyle = {
      width: 24,
      height: 12,
      borderRadius: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2
    };
    
    // Apply different styles based on pill type
    switch(pillType) {
      case 'purple-white':
      case 'antidepressant':
      case 'antidep':
        return (
          <View style={containerStyle}>
            <View style={[pillStyle, { backgroundColor: '#6B5DFF' }]} />
          </View>
        );
      case 'blue':
      case 'general':
        return (
          <View style={containerStyle}>
            <View style={[pillStyle, { backgroundColor: '#45B3FE' }]} />
          </View>
        );
      case 'orange':
      case 'hypertension':
        return (
          <View style={containerStyle}>
            <View style={[pillStyle, { backgroundColor: '#FFB95A' }]} />
          </View>
        );
      case 'white':
      case 'pill':
      default:
        return (
          <View style={containerStyle}>
            <View style={[pillStyle, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0' }]} />
          </View>
        );
    }
  };
  
  const renderMedication = ({ item }) => {
    console.log(`Rendering medication: ${item.name}, pill type: ${item.pillType}`);
    // Ensure we have a valid icon
    const iconSource = getMedicationIcon(item.iconType);
    
    // Get status display information
    const getStatusInfo = () => {
      switch(item.status) {
        case 'taken':
          return {
            icon: 'checkmark-circle',
            color: '#4CAF50',
            text: 'TAKEN'
          };
        case 'skipped':
          return {
            icon: 'close-circle',
            color: '#FF5A5A',
            text: 'SKIPPED'
          };
        default:
          return {
            icon: 'time-outline',
            color: '#FFA726',
            text: 'PENDING'
          };
      }
    };
    
    const statusInfo = getStatusInfo();
    
    return (
      <TouchableOpacity 
        style={[
          styles.medicationCard, 
          item.status === 'taken' && styles.takenMedicationCard,
          item.status === 'skipped' && styles.skippedMedicationCard
        ]}
        onPress={() => {
          setSelectedMedication(item);
          setDetailsModalVisible(true);
        }}
      >
        <View style={styles.medicationContent}>          <View style={[
            styles.medicationIconContainer, 
            { backgroundColor: item.color ? `${item.color}20` : '#F0F4FF' }
          ]}>
            {item.pillType ? (
              // Show pill visualization if we have pill type
              renderPillIcon(item.pillType)
            ) : iconSource ? (
              // Fall back to standard medication icon if no pill type
              <Image 
                source={iconSource} 
                style={[
                  styles.medicationIconImage,
                  (item.status === 'taken' || item.status === 'skipped') && styles.fadedIconImage
                ]}
                resizeMode="contain"
                defaultSource={MEDICATION_ICONS.general} // Fallback icon
              />
            ) : (
              <Ionicons name="medical" size={24} color="#4B70FE" />
            )}
            {item.status === 'taken' && (
              <View style={styles.statusIndicator}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
              </View>
            )}
            {item.status === 'skipped' && (
              <View style={styles.statusIndicator}>
                <Ionicons name="close-circle" size={18} color="#FF5A5A" />
              </View>
            )}
          </View>
          <View style={styles.medicationInfo}>
            <Text style={[
              styles.medicationName,
              (item.status === 'taken' || item.status === 'skipped') && styles.fadedText
            ]}>
              {item.name || 'Unknown Medication'}
            </Text>
            <Text style={[
              styles.medicationDosage, 
              {color: item.color || '#4B70FE'},
              (item.status === 'taken' || item.status === 'skipped') && styles.fadedText
            ]}>
              {item.dosage || 'No dosage'}
            </Text>
            <Text style={[
              styles.medicationFrequency,
              (item.status === 'taken' || item.status === 'skipped') && styles.fadedText
            ]}>
              {item.frequency || 'As needed'}
            </Text>
            {item.time && (
              <View style={styles.timeContainer}>
                <Text style={[
                  styles.timeText,
                  (item.status === 'taken' || item.status === 'skipped') && styles.fadedText
                ]}>
                  {item.time}
                </Text>
                <Text style={[
                  styles.remainingText,
                  (item.status === 'taken' || item.status === 'skipped') && styles.fadedText
                ]}>
                  {item.remainingCount || 'Quantity unknown'}
                </Text>
              </View>
            )}
            
            {item.status === 'taken' && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>Taken</Text>
              </View>
            )}
            
            {item.status === 'skipped' && (
              <View style={[styles.statusBadge, styles.skippedBadge]}>
                <Text style={styles.statusBadgeText}>Skipped</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent's onPress
              if (item.status === 'pending') {
                // Show quick actions for pending medications
                Alert.alert(
                  'Medication Actions',
                  `${item.name} - ${item.dosage}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Mark as Taken', onPress: () => handleMedicationStatus(item, 'taken') },
                    { text: 'Skip', onPress: () => handleMedicationStatus(item, 'skipped') }
                  ]
                );
              } else {
                // Show action to reset status for taken or skipped medications
                Alert.alert(
                  'Medication Actions',
                  `${item.name} - Currently ${item.status}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset to Pending', onPress: () => handleResetMedicationStatus(item) }
                  ]
                );
              }
            }}
          >
            {item.status === 'pending' ? (
              <Text style={styles.moreButtonText}>⋮</Text>
            ) : (
              <Ionicons name="refresh-outline" size={18} color="#888" />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMedicationDetails = () => {
    if (!selectedMedication) return null;

    return (
      <View style={styles.detailsContainer}>
        {/* Pull down indicator */}
        <View style={styles.pullIndicator}>
          <View style={styles.pullIndicatorBar} />
        </View>          {/* Header and image */}        <View style={styles.detailsImageContainer}>
          <View style={styles.detailsIconContainer}>
            {selectedMedication.pillType ? (
              // Show pill visualization with larger dimensions for the modal
              <View style={{ transform: [{ scale: 2 }] }}>
                {renderPillIcon(selectedMedication.pillType)}
              </View>
            ) : (
              <Image 
                source={getMedicationIcon(selectedMedication.iconType)} 
                style={styles.detailsIconImage}
                resizeMode="contain"
                defaultSource={MEDICATION_ICONS.general} // Fallback icon
              />
            )}
          </View>
        </View>
        
        {/* Medication details */}
        <View style={styles.detailsInfoContainer}>
          <Text style={styles.detailsTitle}>{selectedMedication.name}</Text>
          
          <View style={styles.detailsRow}>
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Dosage</Text>
              <Text style={styles.detailsValue}>{selectedMedication.dosage}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Category</Text>
              <Text style={styles.detailsValue}>Prescription</Text>
            </View>
          </View>
          
          <View style={styles.detailsRow}>
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Frequency</Text>
              <Text style={styles.detailsValue}>{selectedMedication.frequency}</Text>
            </View>
            
            <View style={styles.detailsItem}>
              <Text style={styles.detailsLabel}>Time</Text>
              <Text style={styles.detailsValue}>{selectedMedication.time}</Text>
            </View>
          </View>
          
          <View style={styles.detailsFullWidth}>
            <Text style={styles.detailsLabel}>Remaining</Text>
            <Text style={styles.detailsValue}>{selectedMedication.remainingCount}</Text>
          </View>
          
          <View style={styles.detailsFullWidth}>
            <Text style={styles.detailsLabel}>Notes</Text>
            <Text style={styles.detailsValue}>Take with food. Avoid alcohol while taking this medication.</Text>
          </View>
        </View>        {/* Status indicator */}
        {selectedMedication && selectedMedication.status && selectedMedication.status !== 'pending' && (
          <View style={[
            styles.detailsStatusBadge,
            selectedMedication.status === 'skipped' && styles.detailsSkippedBadge
          ]}>
            <Text style={styles.detailsStatusText}>
              {selectedMedication.status === 'taken' ? 'TAKEN' : 'SKIPPED'}
            </Text>
            {selectedMedication.takenAt && (
              <Text style={styles.detailsStatusTimeText}>
                {new Date(selectedMedication.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        )}
        
        {/* Action buttons */}
        <View style={styles.detailsButtonsContainer}>
          {selectedMedication && selectedMedication.status === 'pending' ? (
            <>
              <TouchableOpacity 
                style={styles.skipButton} 
                onPress={() => {
                  handleMedicationStatus(selectedMedication, 'skipped');
                  setDetailsModalVisible(false);
                }}
              >
                <MaterialIcons name="close-circle-outline" size={24} color="#FF4A4A" />
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.takenButton} 
                onPress={() => {
                  handleMedicationStatus(selectedMedication, 'taken');
                  setDetailsModalVisible(false);
                }}
              >
                <MaterialIcons name="check-circle-outline" size={24} color="#FFF" />
                <Text style={styles.takenButtonText}>Mark as Taken</Text>
              </TouchableOpacity>
            </>
          ) : selectedMedication && (selectedMedication.status === 'taken' || selectedMedication.status === 'skipped') ? (
            <>
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={() => {
                  handleResetMedicationStatus(selectedMedication);
                  setDetailsModalVisible(false);
                }}
              >
                <Ionicons name="refresh-outline" size={24} color="#666" />
                <Text style={styles.resetButtonText}>Reset to Pending</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setDetailsModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#666" />
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setDetailsModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color="#666" />
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };  // Handle medication status change (taken or skipped)
  const handleMedicationStatus = async (medication, status) => {
    console.log("Medication object:", JSON.stringify(medication));
    console.log("Token available:", !!token);
    
    if (!token) {
      Alert.alert('Error', 'Authentication token missing. Please login again.');
      return;
    }
    
    if (!medication || !medication.reminderMedId) {
      console.error("Missing medication info:", medication);
      Alert.alert('Error', 'Cannot update medication status: Missing medication ID information');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Show a temporary toast or feedback that we're updating
      let statusText = status === 'taken' ? 'taken' : 'skipped';
      console.log(`Updating medication ${medication.name} status to ${statusText}...`);
      console.log(`Medication ID: ${medication.id}, Reminder Med ID: ${medication.reminderMedId}`);      let response;
      
      // Handle mock data differently
      if (medication.reminderMedId && typeof medication.reminderMedId === 'string' && medication.reminderMedId.startsWith('mock-')) {
        console.log(`Using mock implementation for ${status} on mock medication`);
        // Simulate successful response for mock data
        response = {
          success: true,
          data: { 
            reminderMedId: medication.reminderMedId,
            status: status
          }
        };
      } else {
        // Real API calls for actual data
        if (status === 'taken') {
          response = await ReminderService.markAsTaken(token, medication.reminderMedId);
        } else if (status === 'skipped') {
          response = await ReminderService.markAsSkipped(token, medication.reminderMedId);
        }
      }
      
      // Log the response for debugging
      console.log(`API Response for ${statusText}:`, JSON.stringify(response));
        if (response && response.success) {
        // Update local state to reflect the status change
        const updatedMedications = medications.map(med => {
          // Compare IDs with string conversion for safety
          // This ensures that numbers and strings can be compared correctly
          const medIdMatches = String(med.id) === String(medication.id);
          const reminderMedIdMatches = String(med.reminderMedId) === String(medication.reminderMedId);
          
          if (medIdMatches && reminderMedIdMatches) {
            return { ...med, status, takenAt: new Date().toISOString() };
          }
          return med;
        });
        
        setMedications(updatedMedications);
        
        // Update the selected medication if in modal
        if (selectedMedication && selectedMedication.id === medication.id) {
          setSelectedMedication({ ...selectedMedication, status, takenAt: new Date().toISOString() });
        }
        
        // Show success message
        if (status === 'taken') {
          Alert.alert('Success', `${medication.name} marked as taken`);
        } else {
          Alert.alert('Success', `${medication.name} skipped`);
        }
      } else {
        const errorMsg = response?.error || `Failed to mark medication as ${statusText}`;
        Alert.alert('Error', `${errorMsg}. Please try again.`);
      }
    } catch (error) {
      console.error(`Error marking medication as ${status}:`, error);
      Alert.alert('Error', `Failed to update medication status. ${error.message || 'Network error'}`);
    } finally {
      setIsLoading(false);
    }
  };
    // Handle resetting medication status to pending
  const handleResetMedicationStatus = async (medication) => {
    console.log("Reset medication object:", JSON.stringify(medication));
    console.log("Token available:", !!token);
    
    if (!token) {
      Alert.alert('Error', 'Authentication token missing. Please login again.');
      return;
    }
    
    if (!medication || !medication.reminderMedId) {
      console.error("Missing medication info for reset:", medication);
      Alert.alert('Error', 'Cannot reset medication status: Missing medication ID information');
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log(`Resetting status for medication ${medication.name}...`);
        let response;
      
      // Handle mock data differently
      if (medication.reminderMedId && typeof medication.reminderMedId === 'string' && medication.reminderMedId.startsWith('mock-')) {
        console.log(`Using mock implementation for reset on mock medication`);
        // Simulate successful response for mock data
        response = {
          success: true,
          data: { 
            reminderMedId: medication.reminderMedId,
            status: 'pending'
          }
        };
      } else {
        response = await ReminderService.resetMedicationStatus(token, medication.reminderMedId);
      }
        if (response && response.success) {
        // Update local state to reflect the status change
        const updatedMedications = medications.map(med => {
          // Compare IDs with string conversion for safety
          // This ensures that numbers and strings can be compared correctly
          const medIdMatches = String(med.id) === String(medication.id);
          const reminderMedIdMatches = String(med.reminderMedId) === String(medication.reminderMedId);
          
          if (medIdMatches && reminderMedIdMatches) {
            return { ...med, status: 'pending', takenAt: null };
          }
          return med;
        });
        
        setMedications(updatedMedications);
        
        // Update the selected medication if in modal
        if (selectedMedication && selectedMedication.id === medication.id) {
          setSelectedMedication({ ...selectedMedication, status: 'pending', takenAt: null });
        }
        
        Alert.alert('Status Reset', `${medication.name} has been reset to pending`);
      } else {
        const errorMsg = response?.error || 'Failed to reset medication status';
        Alert.alert('Error', `${errorMsg}. Please try again.`);
      }
    } catch (error) {
      console.error('Error resetting medication status:', error);
      Alert.alert('Error', `Failed to reset medication status. ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  // Fetch medications and reminders for the selected date
  useEffect(() => {
    const fetchMedicationsAndReminders = async () => {
      if (!token) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch reminders for the selected date
        console.log(`Fetching reminders for date: ${selectedFullDate}`);
        const reminderResponse = await ReminderService.getRemindersByDate(token, selectedFullDate);
          // Check if we have valid data in the response
        if (reminderResponse && reminderResponse.success) {
          // Handle the case where the data structure might not be what we expect
          const remindersData = reminderResponse.data?.reminders || [];
          
          // Debug log to see what we're getting from the backend
          console.log(`DEBUG: Got reminders response for date ${selectedFullDate}:`, 
            JSON.stringify(reminderResponse, null, 2));
          console.log(`DEBUG: Found ${remindersData.length} reminders for date ${selectedFullDate}`);
          
          setReminders(remindersData);
              // Extract medication data from reminders
          const medicationsForToday = [];
          
          // Get available icon types from our list
          const availableIconTypes = Object.keys(MEDICATION_ICONS);
          
          console.log(`Processing ${remindersData.length} reminders for today`);
          if (remindersData.length > 0) {
            console.log('First reminder:', JSON.stringify(remindersData[0], null, 2));
          }
          
          remindersData.forEach(reminder => {
            console.log(`Reminder ${reminder.id}: ${reminder.title}, has ${reminder.medications?.length || 0} medications`);
            
            if (reminder.medications && reminder.medications.length > 0) {
              reminder.medications.forEach(med => {
                console.log(`Processing medication: ${JSON.stringify(med, null, 2)}`);
                
                // Choose a random icon if the provided one is not available
                let icon = med.iconType || med.icon_type || 'medicine';
                if (!availableIconTypes.includes(icon)) {
                  // Pick a random icon from our available types
                  const randomIndex = Math.floor(Math.random() * availableIconTypes.length);
                  icon = availableIconTypes[randomIndex];
                }
                
                // Make sure we have a valid reminderMedId
                const reminderMedId = med.reminderMedId || med.reminder_med_id || med.id;
                const medicationId = med.medicationId || med.medication_id || `temp-${Math.random().toString(36).substring(2, 9)}`;
                
                // Add debug information
                if (!reminderMedId) {
                  console.log(`Warning: Missing reminderMedId for medication ${med.name || 'unknown'}`);
                } else {
                  console.log(`Successfully found reminderMedId: ${reminderMedId} for ${med.name || 'unknown'}`);
                }
                
                // Determine pill type based on icon or explicit pill_type
                let pillType = 'white';
                if (med.pillType) {
                  pillType = med.pillType;
                } else if (med.pill_type) {
                  pillType = med.pill_type;
                } else {
                  // Infer from icon
                  if (icon === 'antidepressant' || icon === 'antidep') {
                    pillType = 'purple-white';
                  } else if (icon === 'general') {
                    pillType = 'blue';
                  } else if (icon === 'hypertension') {
                    pillType = 'orange';
                  }
                }
                
                medicationsForToday.push({
                  id: medicationId,
                  name: med.name || 'Unknown Medication',
                  dosage: med.dosage || med.med_dosage || 'No dosage info',
                  frequency: reminder.title || 'As needed',
                  time: med.scheduleTime || reminder.time || 'Anytime',
                  pillType: pillType,
                  remainingCount: med.remainingQuantity 
                    ? `${med.remainingQuantity} ${med.unit || 'units'} remain` 
                    : 'Quantity unknown',
                  iconType: icon,
                  status: med.status || 'pending',
                  reminderMedId: reminderMedId, // Use the validated reminderMedId
                  color: med.color || '#4B70FE'
                });
              });
            }
          });
          
          setMedications(medicationsForToday);
        } else {
          // If there's no success in the response, use mock data as fallback
          console.log('Using fallback mock data');
          const hourString = format(new Date(), 'HH');
          const mockMeds = mockMedicationData[hourString] || mockMedicationData['08'] || [];
          setMedications(mockMeds);
          
          // Only show error if it was an actual API error, not just empty data
          if (!reminderResponse || !reminderResponse.success) {
            setError('Could not retrieve medication data from the server. Showing sample data instead.');
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        
        // Use mock data as fallback when there's an error
        const hourString = format(new Date(), 'HH');
        const mockMeds = mockMedicationData[hourString] || mockMedicationData['08'] || [];
        setMedications(mockMeds);
        
        setError('Error connecting to the server. Showing sample data instead.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMedicationsAndReminders();
  }, [token, selectedFullDate]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.profileButton} onPress={() => setSidebarVisible(true)}>
          <Ionicons name="person-circle-outline" size={32} color="#4A6AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>      {/* Date Title */}
      <Text style={styles.dateTitle}>Today, {format(new Date(), 'dd MMMM yyyy')}</Text>      {/* Month Days */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.weekDaysContainer}
        contentContainerStyle={styles.weekDaysContent}
        initialScrollOffset={0} // Başlangıçta en başa kaydır
      >
        {weekDaysState.map((day, index) => (
          <React.Fragment key={index}>
            {renderWeekDay(day, index)}
          </React.Fragment>
        ))}
      </ScrollView>{/* Medications Section */}
      <View style={styles.medicationsContainer}>
        <View style={styles.medicationsHeader}>
          <Text style={styles.medicationsTitle}>
            {!isLoading && medications.length > 0 
              ? `Medications for ${format(new Date(selectedFullDate), 'MMM dd')}` 
              : 'Medications for Today'}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Medications')}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4B70FE" />
            <Text style={styles.loadingText}>Loading your medications...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#FF5A5A" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setIsLoading(true);
                // Re-fetch data by toggling the selected date
                setSelectedDate(selectedDate);
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={medications}
            renderItem={renderMedication}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.medicationsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No medications scheduled for this date</Text>
              </View>
            )}
          />
        )}
      </View>      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Calendar')}
        >
          <Ionicons name="calendar-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Medications')}
        >
          <Ionicons name="add-circle" size={24} color="#4A6AFF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="cog-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => setSidebarVisible(true)}
        >
          <Ionicons name="person-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>{/* Sidebar positioned with higher zIndex to appear over bottom nav */}
      <MusicSidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
        navigation={navigation}
      />{/* Medication Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setDetailsModalVisible(false)}
          />
          <PanGestureHandler
            onGestureEvent={gestureHandler}
          >
            <Animated.View 
              style={[
                styles.modalContent,
                animatedStyle
              ]}
            >
              {renderMedicationDetails()}
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F1',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#4B70FE',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  errorText: {
    marginTop: 10,
    color: '#FF5A5A',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#4B70FE',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 2,
  },  takenMedicationCard: {
    backgroundColor: '#F8FFF8', // Light green background for taken medications
    borderColor: '#E0F0E0',
    borderWidth: 1,
    opacity: 0.8,
  },
  skippedMedicationCard: {
    backgroundColor: '#FFF8F8', // Light red background for skipped medications
    borderColor: '#FFE0E0',
    borderWidth: 1,
    opacity: 0.8,
  },
  fadedIconImage: {
    opacity: 0.6,
  },
  fadedText: {
    opacity: 0.6,
  },
  statusBadge: {
    backgroundColor: '#E0F7E0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  skippedBadge: {
    backgroundColor: '#FFE8E8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  pendingBadge: {
    backgroundColor: '#FFF8E0',
  },
  pendingBadgeText: {
    color: '#FFA726',
  },
  skippedMedicationCard: {
    borderColor: '#F0E0E0',
    borderWidth: 1,
    opacity: 0.8,
  },
  fadedText: {
    opacity: 0.7,
  },
  fadedIconImage: {
    opacity: 0.5,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileButton: {
    padding: 5,
  },
  menuButton: {
    padding: 5,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    color: '#1A1A1A',
  },
  weekDaysContainer: {
    marginTop: 25,
  },
  weekDaysContent: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  dayItem: {
    width: 50, // Daha küçük genişlik
    height: 75, // Daha küçük yükseklik
    backgroundColor: '#fff',
    borderRadius: 25, // Biraz daha küçük köşe yuvarlaklığı
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 6, // Sağ marj azaltıldı, daha fazla gün görüntülenek
  },
  selectedDayItem: {
    backgroundColor: '#4A6AFF',
  },
  dayText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  selectedText: {
    color: '#fff',
  },
  medicationsContainer: {
    flex: 1,
    marginTop: -300, // Reduced from 35 to 20
  },
  medicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Reduced from 20 to 15
  },
  medicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  viewAllText: {
    fontSize: 15,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  medicationsList: {
    paddingHorizontal: 20,
  },
  medicationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  medicationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },  medicationIconContainer: {
    marginRight: 18,
    backgroundColor: '#F0F4FF',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  medicationIconImage: {
    width: 40,
    height: 40,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  medicationDosage: {
    fontSize: 15,
    color: '#4B70FE',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationFrequency: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  moreButton: {
    padding: 5,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 25,
  },
  navItem: {
    padding: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Pull indicator
  pullIndicator: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  pullIndicatorBar: {
    width: 40,
    height: 5,
    backgroundColor: '#DDD',
    borderRadius: 5,
  },
  
  // Details content
  detailsContainer: {
    paddingBottom: 30,
  },
  detailsImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  detailsIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },  detailsIconImage: {
    width: 80,
    height: 80,
  },
  detailsInfoContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  detailsTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsItem: {
    width: '48%',
  },
  detailsFullWidth: {
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Action buttons
  detailsButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  takenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 2,
  },
  takenButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flex: 1,
  },
  resetButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    flex: 1,
  },
  skipButtonText: {
    color: '#FF4A4A',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flex: 1,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 6,
  },
  statusBadge: {
    backgroundColor: '#E0F7E0',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  skippedBadge: {
    backgroundColor: '#FFE8E8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  detailsStatusBadge: {
    backgroundColor: '#E0F7E0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignSelf: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsSkippedBadge: {
    backgroundColor: '#FFE8E8',
  },
  detailsStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  detailsStatusTimeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4CAF50',
    marginLeft: 8,
  },
});

export default HomeScreen;