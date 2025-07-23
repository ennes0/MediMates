import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Card, Button, Menu, Divider } from 'react-native-paper';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import CustomHeader from '../../components/navigation/CustomHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanResponder } from 'react-native';
import { useAuth } from '../../components/context/AuthContext';
import { ReminderService, MedicationService } from '../../services/api';
import { format, parse, isEqual, parseISO, startOfDay } from 'date-fns';
import { medicationIcons } from '../../constants/medicationIcons';

// Import API_URL for connectivity checks
import { API_URL } from '../../services/api';

// Custom Dropdown Component
const FormDropdown = ({ label, options, value, onSelect, placeholder }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  // Use a custom modal rather than Menu for better z-index handling
  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity 
        style={styles.dropdownButton}
        onPress={() => setModalVisible(true)}
      >
        <Text 
          style={[
            styles.dropdownButtonText, 
            !selectedOption && { color: '#95A5A6' }
          ]}
        >
          {displayValue}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={24} color="#2C3E50" />
      </TouchableOpacity>
      
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownModalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>{`Select ${label}`}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.dropdownList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    value === item.value && styles.dropdownItemSelected
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <Text 
                    style={[
                      styles.dropdownItemText,
                      value === item.value && styles.dropdownItemTextSelected
                    ]}
                  >
                    {item.label}
                  </Text>
                  {value === item.value && (
                    <Ionicons name="checkmark" size={20} color="#3498DB" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Medication form data options
const medicationOptions = {
  medicationTypes: [
    { value: 'analgesic', label: 'Analgesic (Pain Reliever)' },
    { value: 'antibiotic', label: 'Antibiotic' },
    { value: 'antihistamine', label: 'Antihistamine' },
    { value: 'antidepressant', label: 'Antidepressant' },
    { value: 'antiviral', label: 'Antiviral' },
    { value: 'anticoagulant', label: 'Anticoagulant' },
    { value: 'antihypertensive', label: 'Antihypertensive' },
    { value: 'nsaid', label: 'NSAID (Anti-inflammatory)' },
    { value: 'steroid', label: 'Steroid' },
    { value: 'vitamin', label: 'Vitamin Supplement' },
    { value: 'antacid', label: 'Antacid' },
    { value: 'bronchodilator', label: 'Bronchodilator' },
    { value: 'statin', label: 'Statin (Cholesterol)' },
    { value: 'other', label: 'Other' }
  ],
  
  dosages: [
    { value: '10mg', label: '10mg' },
    { value: '25mg', label: '25mg' },
    { value: '50mg', label: '50mg' },
    { value: '75mg', label: '75mg' },
    { value: '100mg', label: '100mg' },
    { value: '150mg', label: '150mg' },
    { value: '200mg', label: '200mg' },
    { value: '250mg', label: '250mg' },
    { value: '300mg', label: '300mg' },
    { value: '325mg', label: '325mg' },
    { value: '400mg', label: '400mg' },
    { value: '500mg', label: '500mg' },
    { value: '600mg', label: '600mg' },
    { value: '750mg', label: '750mg' },
    { value: '800mg', label: '800mg' },
    { value: '1000mg', label: '1000mg' },
    { value: '1g', label: '1g' },
    { value: '2.5ml', label: '2.5ml' },
    { value: '5ml', label: '5ml' },
    { value: '10ml', label: '10ml' },
    { value: '15ml', label: '15ml' },
    { value: '20ml', label: '20ml' },
    { value: '1mcg', label: '1mcg' },
    { value: '5mcg', label: '5mcg' },
    { value: '10mcg', label: '10mcg' },
    { value: '20mcg', label: '20mcg' },
    { value: '50mcg', label: '50mcg' },
    { value: '100mcg', label: '100mcg' },
    { value: 'custom', label: 'Custom Dosage...' }
  ],
  
  frequencies: [
    { value: 'daily', label: 'Once Daily' },
    { value: 'twice_daily', label: 'Twice Daily (BID)' },
    { value: 'three_daily', label: 'Three Times Daily (TID)' },
    { value: 'four_daily', label: 'Four Times Daily (QID)' },
    { value: 'every_morning', label: 'Every Morning' },
    { value: 'every_evening', label: 'Every Evening' },
    { value: 'every_other_day', label: 'Every Other Day' },
    { value: 'weekly', label: 'Once Weekly' },
    { value: 'biweekly', label: 'Twice Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'as_needed', label: 'As Needed (PRN)' },
    { value: 'custom', label: 'Custom Schedule' }
  ],
  
  units: [
    { value: 'tablet', label: 'Tablet' },
    { value: 'capsule', label: 'Capsule' },
    { value: 'pill', label: 'Pill' },
    { value: 'liquid', label: 'Liquid (ml)' },
    { value: 'injection', label: 'Injection' },
    { value: 'patch', label: 'Patch' },
    { value: 'inhaler', label: 'Inhaler (puffs)' },
    { value: 'drops', label: 'Drops' },
    { value: 'spray', label: 'Spray' },
    { value: 'cream', label: 'Cream' },
    { value: 'ointment', label: 'Ointment' },
    { value: 'suppository', label: 'Suppository' }
  ],
  
  whenToTake: [
    { value: 'before_meal', label: 'Before meals' },
    { value: 'with_meal', label: 'With meals' },
    { value: 'after_meal', label: 'After meals' },
    { value: 'empty_stomach', label: 'On empty stomach' },
    { value: 'bedtime', label: 'At bedtime' },
    { value: 'morning', label: 'In the morning' },
    { value: 'evening', label: 'In the evening' },
    { value: 'with_water', label: 'With water' },
    { value: 'without_water', label: 'Without water' },
    { value: 'custom', label: 'Custom instructions' }
  ],

  times: Array(24).fill(0).map((_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { 
      value: `${hour}:00`,
      label: `${hour}:00${i < 12 ? ' AM' : ' PM'}`
    };
  })
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Medication database for search functionality
const medicationDatabase = [
  { id: '1', name: 'Paracetamol', description: 'Pain reliever and fever reducer' },
  { id: '2', name: 'Aspirin', description: 'Pain reliever, anti-inflammatory' },
  { id: '3', name: 'Ibuprofen', description: 'NSAID pain reliever, anti-inflammatory' },
  { id: '4', name: 'Amoxicillin', description: 'Antibiotic medication' },
  { id: '5', name: 'Loratadine', description: 'Antihistamine for allergies' },
  { id: '6', name: 'Atorvastatin', description: 'Cholesterol medication (statin)' },
  { id: '7', name: 'Omeprazole', description: 'Proton pump inhibitor for acid reflux' },
  { id: '8', name: 'Metformin', description: 'Medication for type 2 diabetes' },
  { id: '9', name: 'Lisinopril', description: 'ACE inhibitor for blood pressure' },
  { id: '10', name: 'Gabapentin', description: 'Anti-seizure and nerve pain medication' },
];

const CalendarScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formattedSelectedDate, setFormattedSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [currentCardPage, setCurrentCardPage] = useState({});

  const carouselScrollRefs = useRef({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMedications, setUserMedications] = useState([]);  const [isUsingMockData, setIsUsingMockData] = useState(false);
  
  // Helper function to check API connectivity
  const checkAPIConnectivity = async () => {
    try {
      const controller = new AbortController();      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // First try the medication health check endpoint
      console.log(`Checking API health check: ${API_URL}/medications/health-check`);
      const response = await fetch(`${API_URL}/medications/health-check`, { 
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      clearTimeout(timeoutId);
      
      // If we get a response, that's a good sign
      console.log('Health check response status:', response.status);
      
      if (response.ok) {
        console.log('API health check endpoint is responding');
        return true;
      }
      
      // Try the medication schema debug endpoint
      console.log('Trying debug schema endpoint');
      const debugController = new AbortController();
      const debugTimeoutId = setTimeout(() => debugController.abort(), 5000);
      
      const debugResponse = await fetch(`${API_URL}/medications/debug/schema`, { 
        method: 'GET',
        signal: debugController.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store'
        }
      });
      
      clearTimeout(debugTimeoutId);
      
      if (debugResponse.ok || debugResponse.status === 401) {
        console.log('Debug schema endpoint responded');
        return true;
      }
      
      // Last resort: try the server root
      return await checkServerRoot();
    } catch (error) {
      console.log('API connectivity check failed:', error);
      
      // Try an alternative method if the endpoints fail
      return await checkServerRoot();
    }
  };
  
  // Helper function to check server root as last resort
  const checkServerRoot = async () => {
    try {
      console.log('Trying server root as last resort');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const rootResponse = await fetch(API_URL.substring(0, API_URL.lastIndexOf('/api')), { 
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store'  
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('Server root response:', rootResponse.status);
      return rootResponse.ok;
    } catch (e) {
      console.log('Alternative connectivity check also failed:', e);
      return false;    }
  };
  
  // Helper function to retry connection and reload medications
  const retryConnection = async (maxAttempts = 3) => {
    setIsLoading(true);
    setError(null);
    
    // Show a message that we're trying to connect
    Alert.alert(
      'Checking Connection',
      'Attempting to connect to the medication database...',
      [{ text: 'OK' }]
    );
    
    // Try to create test data first
    if (token) {
      try {
        console.log('Attempting to create test medication data');
        const testDataResponse = await fetch(`${API_URL}/medications/debug/create-test-data`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        const testDataResult = await testDataResponse.json();
        console.log('Test data creation response:', testDataResult);
      } catch (testDataError) {
        console.log('Error creating test data:', testDataError);
      }
    }
    
    // Multiple retry attempt logic
    let attempts = 0;
    let connected = false;
    
    while (attempts < maxAttempts && !connected) {
      attempts++;
      
      try {
        console.log(`Connection attempt ${attempts} of ${maxAttempts}...`);
        
        const isConnected = await checkAPIConnectivity();
        
        if (isConnected) {
          console.log('API server is reachable, loading medications');
          connected = true;
          
          try {
            // Try loading medications with a fresh request
            const medicationResponse = await MedicationService.getMedications(token);
            
            if (medicationResponse && medicationResponse.success) {
              const medicationsData = medicationResponse.data?.medications || [];
              console.log(`Retrieved ${medicationsData.length} medications on retry`);
              
              // Process the medications as in loadAllMedications
              const transformedMedications = medicationsData.map(med => {
                // ... (same transformation as in loadAllMedications)
                let pillType = 'white';
                if (med.name?.toLowerCase().includes('fluoxetine') || 
                    med.name?.toLowerCase().includes('prozac') || 
                    med.pill_type === 'purple-white' ||
                    med.icon_type === 'antidepressant') {
                  pillType = 'purple-white';
                } else if (med.name?.toLowerCase().includes('tylenol') ||
                        med.name?.toLowerCase().includes('paracetamol') ||
                        med.pill_type === 'blue' ||
                        med.icon_type === 'general') {
                  pillType = 'blue';
                } else if (med.name?.toLowerCase().includes('aspirin') ||
                          med.pill_type === 'orange' ||
                          med.icon_type === 'hypertension') {
                  pillType = 'orange';
                }
                
                // Determine color
                let color = pillType === 'purple-white' ? '#6B5DFF' : 
                          pillType === 'blue' ? '#45B3FE' : 
                          pillType === 'orange' ? '#FFB95A' : '#FFFFFF';
                
                return {
                  id: med.medication_id || med.id,
                  reminderMedId: med.reminderMedId || med.reminder_med_id || null,
                  name: med.name || 'Unknown Medication',
                  description: med.description || '',
                  dosage: med.dosage || '1 tablet',
                  time: med.time || '12:00 pm',
                  frequency: med.frequency || 'Daily',
                  startDate: med.start_date ? new Date(med.start_date) : new Date(),
                  endDate: med.end_date ? new Date(med.end_date) : new Date(new Date().setMonth(new Date().getMonth() + 1)),
                  timeOfDay: determinTimeOfDay(med.time || ''),
                  notes: med.notes || '',
                  pillType: pillType,
                  isTaken: med.status === 'taken',
                  lastTakenDays: med.lastTakenCount || 3,
                  sideEffects: med.side_effects || '',
                  activeIngredient: med.active_ingredient || med.medication_type || '',
                  medicationType: med.medication_type || '',
                  whenToTake: med.when_to_take || '',
                  remainingQuantity: med.remaining_quantity ? `${med.remaining_quantity} ${med.unit || 'units'} remaining` : '0 remaining',
                  refillDate: med.refill_date ? `Refill by ${format(new Date(med.refill_date), 'MMMM d, yyyy')}` : '',
                  status: med.status || 'pending',
                  unit: med.unit || 'tablet',
                  color: color
                };
              });
              
              console.log(`Transformed ${transformedMedications.length} medications on retry`);
              setUserMedications(transformedMedications);
              setIsUsingMockData(false);
              setError(null);
              
              // Show success message if connection restored after using mock data
              if (isUsingMockData) {
                Alert.alert(
                  'Connection Restored',
                  'Connected to database successfully. Showing your actual medications.',
                  [{ text: 'Great!' }]
                );
              }
              break;
            } else {
              throw new Error('Failed to retrieve valid medication data');
            }
          } catch (dataError) {
            console.error('Error loading medication data:', dataError);
            connected = false;
          }        } else if (attempts === maxAttempts) {
          // If this is the last attempt, show error but don't use mock data
          console.log('API server is unreachable after all attempts, showing empty state');
          setError(`Server unreachable after ${maxAttempts} attempts. Please check your connection.`);
          setUserMedications([]);
          setIsUsingMockData(false);
          
          // Show a detailed error message
          Alert.alert(
            'Connection Error',
            `Could not connect to the medication database after ${maxAttempts} attempts. Check your network connection or server status.`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error(`Error during retry attempt ${attempts}:`, error);
          if (attempts === maxAttempts) {
          setError(`Connection failed: ${error.message}. Please check your connection.`);
          setUserMedications([]);
          setIsUsingMockData(false);
        }
      }
      
      if (!connected && attempts < maxAttempts) {
        // Wait for a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    setIsLoading(false);
  };

  // Generate week days for date selection
  const [weekDaysState, setWeekDaysState] = useState(() => {
    const today = new Date();
    const weekDays = [];
    
    for (let i = -2; i <= 2; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayStr = format(date, 'EEE'); // abbreviated day name
      const dateStr = format(date, 'dd'); // day of month
      const fullDateStr = format(date, 'yyyy-MM-dd'); // full date for API
      
      weekDays.push({
        day: dayStr,
        date: dateStr,
        fullDate: fullDateStr,
        isSelected: i === 0, // Today is selected by default
      });
    }
    
    return weekDays;
  });
  
  // Handle date selection
  const handleDateSelect = (dateStr, fullDateStr, index) => {
    const updatedWeekDays = weekDaysState.map((day, i) => ({
      ...day,
      isSelected: i === index
    }));
    setWeekDaysState(updatedWeekDays);
    setFormattedSelectedDate(fullDateStr);
    
    try {
      const parsedDate = parse(fullDateStr, 'yyyy-MM-dd', new Date());
      setSelectedDate(parsedDate);
    } catch (error) {
      console.error('Error parsing date:', error);
    }
  };
  
  // Render week day item
  const renderWeekDay = ({ item, index }) => (
    <TouchableOpacity 
      style={[styles.dayItem, item.isSelected && styles.selectedDayItem]}
      onPress={() => handleDateSelect(item.date, item.fullDate, index)}
    >
      <Text style={[styles.dayText, item.isSelected && styles.selectedText]}>{item.day}</Text>
      <Text style={[styles.dateText, item.isSelected && styles.selectedText]}>{item.date}</Text>
    </TouchableOpacity>
  );  // New medication form state
  const [newMedication, setNewMedication] = useState({
    name: '',
    description: '',
    dosage: '',
    frequency: 'daily',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    time: '08:00', // Default time
    timeOfDay: ['Morning'],
    notes: '',
    pillType: 'white',
    isTaken: false,
    lastTakenDays: 0,
    sideEffects: '',
    activeIngredient: '',
    medicationType: 'other',
    whenToTake: 'with_meal',
    remainingQuantity: '30',
    unit: 'tablet',
    refillDate: '',
    icon: 'pill',
    icon_type: 'pill',
    color: '#FFFFFF',
  });
  
  // Form modal visibility
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  
  // Loading state
  const [loading, setLoading] = useState(false);

  // Handle search results
  const searchResults = searchQuery.length > 0 
    ? medicationDatabase.filter(med => 
        med.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Function to open medication form with selected medication
  const handleMedicationSelect = (medication) => {
    setNewMedication({
      ...newMedication,
      name: medication.name,
      description: medication.description,
    });
    setModalVisible(false);
    setFormModalVisible(true);
  };
  // Function to save new medication to the database
  const handleSaveMedication = async () => {
    if (!token) {
      Alert.alert('Error', 'Authentication token missing. Please login again.');
      return;
    }
    
    if (!newMedication.name || !newMedication.dosage) {
      Alert.alert('Error', 'Please enter at least the medication name and dosage.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Handle time field - if missing, use timeOfDay to determine a default time
      let timeValue = newMedication.time;
      if (!timeValue) {
        // Set default time based on selected timeOfDay
        if (newMedication.timeOfDay.includes('Morning')) {
          timeValue = '08:00';
        } else if (newMedication.timeOfDay.includes('Afternoon')) {
          timeValue = '13:00';
        } else if (newMedication.timeOfDay.includes('Evening')) {
          timeValue = '18:00';
        } else if (newMedication.timeOfDay.includes('Night')) {
          timeValue = '21:00';
        } else {
          timeValue = '08:00'; // Default fallback
        }
      }
        // Generate time of day information for special instructions instead of when_to_take
      // since when_to_take doesn't exist in the database schema
      let timeOfDayInfo = '';
      if (newMedication.timeOfDay && newMedication.timeOfDay.length > 0) {
        timeOfDayInfo = newMedication.timeOfDay.join(', ');
      }
      
      // Convert remaining quantity to number, ensuring it's at least 0
      let remainingQuantity = 0;
      if (newMedication.remainingQuantity) {
        // If it's a string like "10 tablets remaining", extract the number
        if (typeof newMedication.remainingQuantity === 'string' && newMedication.remainingQuantity.includes(' ')) {
          const parts = newMedication.remainingQuantity.split(' ');
          remainingQuantity = parseInt(parts[0]) || 0;
        } else {
          // Direct parse if it's already a number or simple string
          remainingQuantity = parseInt(newMedication.remainingQuantity) || 0;
        }
      }
        // Prepare the data for API - match the exact structure expected by the backend      // Prepare base medication data - compatible with both creation and updating
      const medicationData = {
        name: newMedication.name.trim(),
        description: newMedication.description || '',
        // Güncellenmiş veritabanıyla uyumluluk için dosage ve strength'i birlikte kullan
        dosage: newMedication.dosage ? newMedication.dosage.trim() : '1',
        strength: newMedication.dosage ? newMedication.dosage.trim() : '1', 
        frequency: newMedication.frequency || 'daily',
        start_date: format(newMedication.startDate, 'yyyy-MM-dd'),
        end_date: format(newMedication.endDate, 'yyyy-MM-dd'),
        time: timeValue,
        // Güncellenmiş veritabanıyla uyumlu alanlar
        notes: newMedication.notes || '',
        active_ingredient: newMedication.activeIngredient || '',
        medication_type: newMedication.medicationType || '',
        side_effects: newMedication.sideEffects || '',
        remaining_quantity: remainingQuantity,
        unit: newMedication.unit || 'tablet',
        refill_date: newMedication.refillDate ? format(newMedication.refillDate, 'yyyy-MM-dd') : null,
        
        // Yeni eklenen alanlar
        pill_type: newMedication.pillType,
        time_of_day: Array.isArray(newMedication.timeOfDay) ? newMedication.timeOfDay.join(", ") : "Morning",
        take_with_food: newMedication.whenToTake === 'with_meal' || newMedication.whenToTake === 'after_meal',
        refill_reminder: !!newMedication.refillDate,
        when_to_take: newMedication.whenToTake || '',
        
        // Icon ve renk alanları - her iki şemayı da desteklemek için
        icon: newMedication.pillType === 'purple-white' ? 'antidepressant' :
              newMedication.pillType === 'blue' ? 'general' :
              newMedication.pillType === 'orange' ? 'hypertension' : 'pill',
        icon_type: newMedication.pillType === 'purple-white' ? 'antidepressant' :
                 newMedication.pillType === 'blue' ? 'general' :
                 newMedication.pillType === 'orange' ? 'hypertension' : 'pill',
        color: newMedication.pillType === 'purple-white' ? '#6B5DFF' :
              newMedication.pillType === 'blue' ? '#45B3FE' :
              newMedication.pillType === 'orange' ? '#FFB95A' : '#FFFFFF',
        
        // Geriye dönük uyumluluk için
        instructions: newMedication.notes || '',
        special_instructions: newMedication.notes ? 
          newMedication.notes + (newMedication.timeOfDay?.length ? ` (${newMedication.timeOfDay.join(', ')})` : '') : 
          (newMedication.timeOfDay?.length ? newMedication.timeOfDay.join(', ') : ''),
          reminder_times: [{
          // The time_of_day column in medication_times table expects a TIME value, not a string like "morning"
          time: timeValue, 
          time_of_day: timeValue // Use the actual time value for time_of_day column
        }]
      };
        console.log('Saving medication:', JSON.stringify(medicationData));
        if (editMode && editIndex >= 0) {
        // Update existing medication in the database
        const medicationId = userMedications[editIndex].id;
        console.log(`Updating medication with ID: ${medicationId}`);          try {
          // Add additional debugging for update operation
          console.log('Current medication:', JSON.stringify(userMedications[editIndex]));
          console.log('Update payload:', JSON.stringify(medicationData));
          
          // Validate that date fields are valid before formatting
          if (medicationData.startDate) {
            console.log('Start date before formatting:', medicationData.startDate, 
              'type:', typeof medicationData.startDate, 
              'isDate:', medicationData.startDate instanceof Date);
            
            // Ensure startDate is a valid Date object
            medicationData.startDate = medicationData.startDate instanceof Date 
              ? medicationData.startDate 
              : new Date(medicationData.startDate);
          }
          
          if (medicationData.endDate) {
            console.log('End date before formatting:', medicationData.endDate, 
              'type:', typeof medicationData.endDate,
              'isDate:', medicationData.endDate instanceof Date);
              
            // Ensure endDate is a valid Date object
            medicationData.endDate = medicationData.endDate instanceof Date
              ? medicationData.endDate
              : new Date(medicationData.endDate);
          }
            
          // Prepare data for database compatibility with correct field mappings
          const cleanedData = prepareCompatibleMedicationData(medicationData);
          console.log('Cleaned update payload:', JSON.stringify(cleanedData));
          
          // Force explicit dates in the correct format
          if (medicationData.startDate) {
            cleanedData.start_date = format(new Date(medicationData.startDate), 'yyyy-MM-dd');
            console.log('Explicitly set start_date to:', cleanedData.start_date);
          }
          
          if (medicationData.endDate) {
            cleanedData.end_date = format(new Date(medicationData.endDate), 'yyyy-MM-dd');
            console.log('Explicitly set end_date to:', cleanedData.end_date);
          }
          
          // Add the reminderMedId if it exists, which may be needed for updating reminders
          if (userMedications[editIndex].reminderMedId) {
            cleanedData.reminder_med_id = userMedications[editIndex].reminderMedId;
          }
          
          // Make sure essential fields are included
          if (!cleanedData.name) {
            cleanedData.name = userMedications[editIndex].name;
          }
          
          const response = await MedicationService.updateMedication(token, medicationId, cleanedData);
          console.log('Update response:', JSON.stringify(response));
            
          if (response && !response.error) {
            // Consider it a success if there's no error property
            const successResponse = response.success !== false;
            
            // Create or update a reminder for this medication
            const reminderCreated = await createOrUpdateReminder(cleanedData, medicationId);
            
            console.log(`Reminder ${reminderCreated ? 'created/updated' : 'failed to create'} for medication ${medicationId}`);
            
            setFormModalVisible(false); // Close the modal
            Alert.alert('Success', 'Medication updated successfully');
            // Reload medications list to get the updated data
            await loadAllMedications();
          } else {
            // Handle error with more detailed information
            console.error('Update failed:', response);
            
            // Handle various error conditions
            if (response?.error?.includes('404') || response?.error?.includes('not found')) {
              // If medication not found, offer to create a new one
              Alert.alert(
                'Medication Not Found',
                'This medication may have been deleted. Would you like to create it as new?',
                [
                  {
                    text: 'Yes, Create as New',
                    onPress: async () => {
                      try {
                        // Use the same data but as a new medication
                        const newResponse = await MedicationService.addMedication(token, cleanedData);
                        if (newResponse && newResponse.success) {
                          setFormModalVisible(false);
                          Alert.alert('Success', 'Medication added as new');
                          await loadAllMedications();
                        } else {
                          Alert.alert('Error', 'Failed to add as new medication');
                        }
                      } catch (err) {
                        console.error('Error creating as new:', err);
                        Alert.alert('Error', 'Failed to create as new medication');
                      }
                    }
                  },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            } else if (response?.error?.includes('Unknown column') || response?.error?.includes('ER_BAD_FIELD_ERROR')) {
              // Handle column errors by trying a simplified update
              Alert.alert(
                'Database Schema Error',
                'There seems to be an issue with the database structure. Would you like to try a simplified update?',
                [
                  {
                    text: 'Try Simplified Update',
                    onPress: async () => {
                      try {                        // Create simplified data with only essential fields
                        // Focus on fields that definitely exist in the database schema
                        const simplifiedData = {
                          name: newMedication.name,
                          description: newMedication.description || '',
                          // strength instead of dosage in the medications table
                          strength: newMedication.dosage,
                          // Use icon instead of icon_type depending on schema
                          icon: cleanedData.icon_type,
                          color: newMedication.pillType === 'purple-white' ? '#6B5DFF' :
                                newMedication.pillType === 'blue' ? '#45B3FE' :
                                newMedication.pillType === 'orange' ? '#FFB95A' : '#FFFFFF'
                        };
                        
                        const simpleResponse = await MedicationService.updateMedication(token, medicationId, simplifiedData);
                        if (simpleResponse && simpleResponse.success) {
                          setFormModalVisible(false);
                          Alert.alert('Success', 'Medication updated with basic information');
                          await loadAllMedications();
                        } else {
                          Alert.alert('Error', 'Could not update medication even with simplified data');
                        }
                      } catch (err) {
                        console.error('Error with simplified update:', err);
                        Alert.alert('Error', 'Failed to update medication');
                      }
                    }
                  },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            } else {
              const errorMsg = response?.error || 'Failed to update medication. Please try again.';
              Alert.alert('Error', errorMsg);
            }
          }
        } catch (updateError) {
          console.error('Exception during update:', updateError);
          Alert.alert('Error', `Update failed: ${updateError.message}`);
        }
      } else {
        // Add new medication to the database
        console.log('Adding new medication to database');          // Prepare data for database compatibility
          const cleanedData = prepareCompatibleMedicationData(medicationData);
          console.log('Cleaned add payload:', JSON.stringify(cleanedData));
          
          const response = await MedicationService.addMedication(token, cleanedData);
          if (response && response.success) {
          // Create a reminder for this new medication
          const medicationId = response.data?.medication?.medication_id;
          if (medicationId) {
            const reminderCreated = await createOrUpdateReminder(cleanedData, medicationId);
            console.log(`Reminder ${reminderCreated ? 'created' : 'failed to create'} for new medication ${medicationId}`);
          } else {
            console.error('Missing medication_id in successful response:', response);
          }
          
          setFormModalVisible(false); // Close the modal
          Alert.alert('Success', 'Medication added successfully');
          // Reload medications list to get the new data
          await loadAllMedications();
        } else {          console.error('API error response:', JSON.stringify(response));          // Handle specific database errors
          if (response?.error?.includes('SQL syntax') || response?.error?.includes('ER_PARSE_ERROR')) {
            Alert.alert(
              'Database Error', 
              'There was a problem with the database. Would you like to try using simplified data?',
              [
                {
                  text: 'Try Simplified',
                  onPress: async () => {
                    // Try adding a simplified medication as a fallback
                    try {
                      setLoading(true);
                      // Use the dedicated simple medication endpoint
                      const simplifiedData = {
                        name: newMedication.name,
                        dosage: newMedication.dosage || '1',
                        icon_type: medicationData.icon_type
                      };
                      console.log('Trying simplified medication data:', simplifiedData);
                        const fallbackResponse = await MedicationService.addSimpleMedication(token, simplifiedData);
                      if (fallbackResponse && fallbackResponse.success) {
                        // Create a reminder for this simplified medication
                        const medicationId = fallbackResponse.data?.medication?.medication_id;
                        if (medicationId) {
                          // Add time to simplifiedData for reminder creation
                          simplifiedData.time = newMedication.time || '09:00';
                          simplifiedData.start_date = format(newMedication.startDate, 'yyyy-MM-dd');
                          
                          const reminderCreated = await createOrUpdateReminder(simplifiedData, medicationId);
                          console.log(`Reminder ${reminderCreated ? 'created' : 'failed to create'} for simplified medication ${medicationId}`);
                        }
                        
                        setFormModalVisible(false);
                        Alert.alert('Success', 'Added medication with basic information');
                        await loadAllMedications();
                      } else {
                        console.error('Failed with simplified data:', fallbackResponse);
                        Alert.alert('Error', 'Could not add medication even with simplified data');
                      }
                    } catch (fallbackError) {
                      console.error('Error in fallback add:', fallbackError);
                      Alert.alert('Error', 'Failed to add medication with simplified data');
                    } finally {
                      setLoading(false);
                    }
                  }
                },
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          } else {
            const errorMsg = response?.error || 'Failed to add medication. Please try again.';
            Alert.alert('Error', errorMsg);
          }
        }
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving medication:', error);
      Alert.alert('Error', `Failed to save medication: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  // Reset the form state
  const resetForm = () => {
    setNewMedication({
      name: '',
      description: '',
      dosage: '',
      frequency: 'daily',
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      time: '08:00',
      timeOfDay: ['Morning'],
      notes: '',
      pillType: 'white',
      isTaken: false,
      lastTakenDays: 0,
      sideEffects: '',
      activeIngredient: '',
      medicationType: 'other',
      whenToTake: 'with_meal',
      remainingQuantity: '30',
      unit: 'tablet',
      refillDate: '',
      icon: 'pill',
      icon_type: 'pill',
      color: '#FFFFFF',
    });
    setEditMode(false);
    setEditIndex(-1);
    setFormModalVisible(false);
  };
  // Function to handle editing a medication  
  const handleEditMedication = (index) => {
    const medication = userMedications[index];
    console.log('Editing medication:', JSON.stringify(medication));
      // Convert dates back to Date objects
    let startDate = new Date();
    let endDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
    
    // Try parsing startDate from multiple possible sources with error handling
    try {
      if (medication.startDate) {
        console.log('Parsing startDate:', medication.startDate, typeof medication.startDate);
        startDate = medication.startDate instanceof Date 
          ? medication.startDate 
          : new Date(medication.startDate);
      } 
      else if (medication.start_date) {
        console.log('Parsing start_date:', medication.start_date, typeof medication.start_date);
        startDate = new Date(medication.start_date);
      }
      console.log('Final startDate:', startDate.toISOString());
    } catch (dateError) {
      console.error('Error parsing startDate:', dateError);
      // Fall back to today
      startDate = new Date();
    }
      
    // Try parsing endDate from multiple possible sources with error handling
    try {
      if (medication.endDate) {
        console.log('Parsing endDate:', medication.endDate, typeof medication.endDate);
        endDate = medication.endDate instanceof Date 
          ? medication.endDate 
          : new Date(medication.endDate);
      }
      else if (medication.end_date) {
        console.log('Parsing end_date:', medication.end_date, typeof medication.end_date);
        endDate = new Date(medication.end_date);
      }
      console.log('Final endDate:', endDate.toISOString());
    } catch (dateError) {
      console.error('Error parsing endDate:', dateError);
      // Fall back to a month from now
      endDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
    }
    
    // Extract remaining quantity numeric value
    let remainingQuantity = '';
    if (medication.remainingQuantity) {
      const match = medication.remainingQuantity.match(/(\d+)/);
      if (match && match[1]) {
        remainingQuantity = match[1];
      }
    }
    
    // Determine pill type based on multiple indicators with priority order
    let pillType = 'white'; // Default pill type
    let iconValue = '';
    let colorValue = medication.color || '';
    
    // Check all possible sources of pill type information
    if (medication.pillType) {
      pillType = medication.pillType;
      console.log('Using direct pillType property:', pillType);
    } 
    else if (medication.pill_type) {
      pillType = medication.pill_type;
      console.log('Using pill_type property:', pillType);
    }
    else {
      // Try to infer from icon_type or icon
      iconValue = medication.iconType || medication.icon_type || medication.icon || '';
      console.log('Icon value for inference:', iconValue);
      
      // Infer from icon type
      if (iconValue === 'antidepressant' || iconValue === 'antidep') {
        pillType = 'purple-white';
      }
      else if (iconValue === 'general') {
        pillType = 'blue';
      }
      else if (iconValue === 'hypertension') {
        pillType = 'orange';
      }
      // If still not set, try to infer from color
      else if (colorValue === '#6B5DFF') {
        pillType = 'purple-white';
      }
      else if (colorValue === '#45B3FE') {
        pillType = 'blue';
      }
      else if (colorValue === '#FFB95A') {
        pillType = 'orange';
      }
      
      console.log(`Inferred pill type ${pillType} from icon ${iconValue} and color ${colorValue}`);
    }
    
    // Determine appropriate color and icon values based on pill type
    let color = '#FFFFFF'; 
    let icon = 'pill';
    
    switch(pillType) {
      case 'purple-white':
        color = '#6B5DFF';
        icon = 'antidepressant';
        break;
      case 'blue':
        color = '#45B3FE';
        icon = 'general';
        break;
      case 'orange':
        color = '#FFB95A';
        icon = 'hypertension';
        break;
      default:
        color = '#FFFFFF';
        icon = 'pill';
    }
      // Extract Time of Day from various sources - güncellenmiş veritabanı alanlarını kontrol et
    let timeOfDay = [];
    
    // Önce time_of_day (yeni alan) kontrolü yap
    if (medication.time_of_day) {
      // Eğer string ise virgülle ayırıp dizi yap
      if (typeof medication.time_of_day === 'string') {
        timeOfDay = medication.time_of_day.split(',').map(time => time.trim());
        console.log('Using time_of_day string from database:', timeOfDay);
      }
    } 
    // Sonra normal timeOfDay alanını kontrol et
    else if (medication.timeOfDay && Array.isArray(medication.timeOfDay) && medication.timeOfDay.length > 0) {
      timeOfDay = medication.timeOfDay;
      console.log('Using timeOfDay array property:', timeOfDay);
    } 
    // Yemekle alınıp alınmadığı bilgisinden çıkarım yap
    else if (medication.take_with_food || medication.whenToTake) {
      const whenToTake = medication.whenToTake ? medication.whenToTake.toLowerCase() : '';
      
      if (whenToTake.includes('morning') || whenToTake.includes('breakfast')) {
        timeOfDay.push('Morning');
      }
      if (whenToTake.includes('afternoon') || whenToTake.includes('lunch')) {
        timeOfDay.push('Afternoon');
      }
      if (whenToTake.includes('evening') || whenToTake.includes('dinner')) {
        timeOfDay.push('Evening');
      }
      if (whenToTake.includes('night') || whenToTake.includes('bedtime')) {
        timeOfDay.push('Night');
      }
      
      console.log('Inferred timeOfDay from whenToTake:', timeOfDay);
    } 
    // Son olarak zaman bilgisinden çıkarım yap
    else if (medication.time) {
      const hourValue = parseInt(medication.time.split(':')[0]);
      if (hourValue >= 5 && hourValue < 12) timeOfDay.push('Morning');
      else if (hourValue >= 12 && hourValue < 17) timeOfDay.push('Afternoon');
      else if (hourValue >= 17 && hourValue < 21) timeOfDay.push('Evening');
      else timeOfDay.push('Night');
      
      console.log('Inferred timeOfDay from time hour:', timeOfDay);
    }
    
    // Hala boşsa, varsayılan Morning kullan
    if (timeOfDay.length === 0) {
      timeOfDay = ['Morning'];
      console.log('Using default timeOfDay: Morning');
    }
    
    // Map medication type to dropdown value
    let medicationType = 'other';
    if (medication.medicationType) {
      // Try to match the medication type to one of our dropdown options
      const matchedType = medicationOptions.medicationTypes.find(type => 
        type.label.toLowerCase().includes(medication.medicationType.toLowerCase())
      );
      if (matchedType) {
        medicationType = matchedType.value;
      } else if (typeof medication.medicationType === 'string') {
        medicationType = medication.medicationType.toLowerCase().replace(/\s+/g, '_');
      }
    }
    
    // Map when to take to dropdown value
    let whenToTake = 'with_meal';
    if (medication.whenToTake) {
      // Try to match to one of our dropdown options
      const matchedWhen = medicationOptions.whenToTake.find(type =>
        type.label.toLowerCase().includes(medication.whenToTake.toLowerCase())
      );
      if (matchedWhen) {
        whenToTake = matchedWhen.value;
      } else if (typeof medication.whenToTake === 'string') {
        whenToTake = 'custom';
      }
    }
    
    // Map unit to dropdown value
    let unit = 'tablet';
    if (medication.unit) {
      const matchedUnit = medicationOptions.units.find(u => 
        u.label.toLowerCase().includes(medication.unit.toLowerCase())
      );
      if (matchedUnit) {
        unit = matchedUnit.value;
      } else if (typeof medication.unit === 'string') {
        unit = medication.unit.toLowerCase().replace(/\s+/g, '_');
      }
    }
      // Map frequency to dropdown value
    let frequency = 'daily';
    if (medication.frequency) {
      const matchedFrequency = medicationOptions.frequencies.find(f => 
        f.label.toLowerCase().includes(medication.frequency.toLowerCase())
      );
      if (matchedFrequency) {
        frequency = matchedFrequency.value;
      } else if (typeof medication.frequency === 'string') {
        frequency = medication.frequency.toLowerCase().replace(/\s+/g, '_');
      }
    }    // Map dosage to dropdown value - güncellenmiş veritabanı ile uyumlu
    let dosage = '500mg';
    
    // Önce doğrudan dosage alanı kontrolü (yeni eklenen alan)
    if (medication.dosage) {
      const matchedDosage = medicationOptions.dosages.find(d => 
        d.value === medication.dosage
      );
      if (matchedDosage) {
        dosage = matchedDosage.value;
      } else {
        // If not found in dropdown options, use the custom value
        dosage = medication.dosage;
      }
      console.log('Using dosage directly:', dosage);
    }
    // Sonra strength alanını kontrol et (eski formatı desteklemek için)
    else if (medication.strength) {
      const matchedDosage = medicationOptions.dosages.find(d => 
        d.value === medication.strength
      );
      if (matchedDosage) {
        dosage = matchedDosage.value;
      } else {
        // If not found in dropdown options, use the custom value
        dosage = medication.strength;
      }
      console.log('Using strength as dosage:', dosage);
    }
      // Set form data with complete information
    setNewMedication({      name: medication.name || '',
      description: medication.description || '',
      dosage: dosage,
      frequency: frequency,
      startDate: startDate,
      endDate: endDate,
      timeOfDay: timeOfDay,
      // Güncellenmiş veritabanı alanlarını kullan
      notes: medication.notes || medication.instructions || medication.special_instructions || '',
      pillType: pillType,
      icon: icon,
      icon_type: icon,
      color: color,
      isTaken: medication.isTaken || medication.status === 'taken' || false,
      lastTakenDays: medication.lastTakenDays || 0,
      // Yan etkiler - yeni veritabanı alanını doğrudan kullan
      sideEffects: medication.side_effects || medication.sideEffects || '',
      // Etken madde - yeni veritabanı alanını doğrudan kullan
      activeIngredient: medication.active_ingredient || medication.activeIngredient || '',
      medicationType: medicationType,
      whenToTake: medication.when_to_take ? medication.when_to_take : whenToTake,
      remainingQuantity: remainingQuantity,
      // Yeniden dolum tarihi için refill_reminder alanını kontrol et
      refillDate: medication.refill_reminder ? medication.refill_date || medication.refillDate || '' : '',
      time: medication.time || '08:00',
      unit: unit,
    });
    
    setEditMode(true);
    setEditIndex(index);
    setFormModalVisible(true);
  };
  
  // Function to delete a medication
  const handleDeleteMedication = async (index) => {
    const medication = userMedications[index];
    
    if (!token || !medication.id) {
      Alert.alert('Error', 'Cannot delete medication: Missing information');
      return;
    }
    
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${medication.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await MedicationService.deleteMedication(token, medication.id);
              
              if (response && response.success) {
                // Remove from local state
                const updatedMedications = [...userMedications];
                updatedMedications.splice(index, 1);
                setUserMedications(updatedMedications);
                
                Alert.alert('Success', 'Medication deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete medication. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting medication:', error);
              Alert.alert('Error', `Failed to delete medication: ${error.message || 'Unknown error'}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };  
    // Function to load all medications from the API
  const loadAllMedications = async () => {
    if (!token) {
      console.log('No auth token available, cannot fetch medications');
      setIsLoading(false);
      setUserMedications([]);
      return;
    }
          
    try {
      setIsLoading(true);
      setError(null);
      setIsUsingMockData(false);
      
      console.log('Fetching all medications from database');
      const medicationResponse = await MedicationService.getMedications(token);
      
      console.log('API Response:', JSON.stringify(medicationResponse));
        if (medicationResponse && medicationResponse.success && medicationResponse.data) {
        const medicationsData = medicationResponse.data.medications || [];
        console.log(`Retrieved ${medicationsData.length} medications from database`);
        
        // Filter to ensure we only have the current user's medications
        const filteredMedications = medicationsData.filter(med => {
          // Make sure we have a valid user_id to check against
          if (!user || !user.id) {
            console.log('No user ID available to filter medications');
            return true; // Keep all meds if we can't filter
          }
          
          const medUserId = med.user_id || med.userId;
          const matches = !medUserId || medUserId === user.id;
          
          console.log(`Medication ${med.name} (ID: ${med.id || med.medication_id}) - user_id: ${medUserId}, current user: ${user.id}, matches: ${matches}`);
          
          return matches;
        });
        
        console.log(`After filtering: ${filteredMedications.length} out of ${medicationsData.length} medications belong to user ${user?.id}`);
        
        // Log the raw data for debugging
        if (filteredMedications.length > 0) {
          console.log('First medication raw data:', JSON.stringify(filteredMedications[0]));
        }        // Transform medications data
        const transformedMedications = filteredMedications.map(med => {
          console.log(`Processing medication ID ${med.id || med.medication_id}, Name: ${med.name}`);
            // Map pill types based on medication type or icon
          let pillType = 'white';
          
          // First check if we have a direct pill_type property
          if (med.pillType) {
            pillType = med.pillType;
          } else if (med.pill_type) {
            pillType = med.pill_type;
          } 
          // If no direct pill_type, infer from icon or icon_type
          else {
            const iconValue = med.iconType || med.icon_type || med.icon;
            
            if (iconValue === 'antidepressant' || 
                iconValue === 'antidep' || 
                med.color === '#6B5DFF') {
              pillType = 'purple-white';
            } 
            else if (iconValue === 'general' || 
                    med.color === '#45B3FE') {
              pillType = 'blue';
            } 
            else if (iconValue === 'hypertension' || 
                    med.color === '#FFB95A') {
              pillType = 'orange';
            }
            
            console.log(`Inferred pill type ${pillType} from icon value ${iconValue} and color ${med.color}`);
          }
          
          // Log the final pill type for this medication
          console.log(`Final pill type for ${med.name}: ${pillType}`);
          
          // Determine color based on pill type
          let color;
          switch(pillType) {
            case 'purple-white':
              color = '#6B5DFF';
              break;
            case 'blue':
              color = '#45B3FE';
              break;
            case 'orange':
              color = '#FFB95A';
              break;
            case 'white':
            default:
              color = '#FFFFFF';
          }
          
          // Calculate last taken days (for progress dots)
          const lastTakenDays = med.lastTakenCount || Math.floor(Math.random() * 7);
            // Format dates - handle all possible date formats properly
          let startDate = new Date();
          let endDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
          
          try {
            // For start_date, try multiple field names and handle string/Date object correctly
            if (med.start_date) {
              console.log(`Processing start_date: ${med.start_date}, type: ${typeof med.start_date}`);
              startDate = new Date(med.start_date);
            } else if (med.startDate) {
              console.log(`Processing startDate: ${med.startDate}, type: ${typeof med.startDate}`);
              startDate = med.startDate instanceof Date ? med.startDate : new Date(med.startDate);
            } else if (med.schedule && med.schedule.start_date) {
              console.log(`Processing schedule.start_date: ${med.schedule.start_date}`);
              startDate = new Date(med.schedule.start_date);
            }
            
            // For end_date, try multiple field names and handle string/Date object correctly
            if (med.end_date) {
              console.log(`Processing end_date: ${med.end_date}, type: ${typeof med.end_date}`);
              endDate = new Date(med.end_date);
            } else if (med.endDate) {
              console.log(`Processing endDate: ${med.endDate}, type: ${typeof med.endDate}`);
              endDate = med.endDate instanceof Date ? med.endDate : new Date(med.endDate);
            } else if (med.schedule && med.schedule.end_date) {
              console.log(`Processing schedule.end_date: ${med.schedule.end_date}`);
              endDate = new Date(med.schedule.end_date);
            }
            
            // Log the final date values for debugging
            console.log(`Final dates for ${med.name}: startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}`);
          } catch (dateError) {
            console.error('Error parsing medication dates:', dateError);
          }
          
          // Get time from either source
          const timeValue = med.time || '08:00';
          
          // Get or generate reminderMedId
          let reminderMedId = med.reminderMedId || med.reminder_med_id;
          if (!reminderMedId && med.id) {
            reminderMedId = `temp-${med.id}`;
          } else if (!reminderMedId) {
            reminderMedId = `temp-${Math.random().toString(36).substring(2, 9)}`;
          }
          
          // Format remaining quantity
          let remainingQty = '';
          if (med.inventory && med.inventory.remainingQuantity) {
            remainingQty = `${med.inventory.remainingQuantity} ${med.inventory.unit || 'units'} remaining`;
          } else if (med.remaining_quantity) {
            remainingQty = `${med.remaining_quantity} ${med.unit || 'units'} remaining`;
          } else if (med.remainingQuantity) {
            remainingQty = med.remainingQuantity;
          } else {
            const randomQty = Math.floor(Math.random() * 30) + 5;
            remainingQty = `${randomQty} ${med.unit || 'tablets'} remaining`;
          }
            // Güncellenmiş veritabanı alanlarını kullanarak ilaç nesnesini oluştur
          // time_of_day alanını işle (yeni eklenen alan)
          let timeOfDayArray = [];
          
          // Önce doğrudan time_of_day alanından değer almayı dene
          if (med.time_of_day && typeof med.time_of_day === 'string') {
            timeOfDayArray = med.time_of_day.split(',').map(time => time.trim());
          } 
          // Eğer time_of_day yoksa zamanı kullanarak çıkarım yap
          else {
            timeOfDayArray = determinTimeOfDay(timeValue) || ['Morning'];
          }
          
          // Refill hatırlatıcısını kontrol et
          const hasRefillReminder = med.refill_reminder === true || med.refill_reminder === 1;
          const refillDateText = (hasRefillReminder && med.refill_date) ? 
                               `Refill by ${format(new Date(med.refill_date), 'MMMM d, yyyy')}` : 
                               med.refillDate || '';
            // Get medication schedules if available
          let scheduleInfo = null;
          if (med.schedule) {
            scheduleInfo = med.schedule;
          } else if (med.schedules && med.schedules.length > 0) {
            scheduleInfo = med.schedules[0];
          }
          
          // Get medication inventory if available
          let inventoryInfo = null;
          if (med.inventory) {
            inventoryInfo = med.inventory;
          }
          
          // Determine dosage value from all possible sources
          const dosageValue = med.dosage || 
                            med.strength || 
                            (scheduleInfo ? scheduleInfo.dosage : null) || 
                            '1 tablet';
          
          // Determine unit value from all possible sources
          const unitValue = med.unit || 
                          (inventoryInfo ? inventoryInfo.unit : null) ||
                          (scheduleInfo ? scheduleInfo.dosage_unit : null) ||
                          'tablet';
          
          // Determine frequency value from all possible sources
          const frequencyValue = med.frequency || 
                               (scheduleInfo ? scheduleInfo.frequency : null) ||
                               'Daily';
          
          // Determine notes from all possible sources
          const notesValue = med.notes || 
                           med.instructions || 
                           (scheduleInfo ? scheduleInfo.special_instructions : null) ||
                           (scheduleInfo ? scheduleInfo.notes : null) ||
                           '';
          
          // Ensure all fields have proper default values
          const whenToTakeValue = med.when_to_take || 
                                med.whenToTake || 
                                (med.take_with_food ? 'with_meal' : '') ||
                                (scheduleInfo ? scheduleInfo.when_to_take : null) ||
                                '';

          // Return the formatted medication object with all fields - enhanced version
          return {
            id: med.id || med.medication_id,
            reminderMedId: reminderMedId,
            name: med.name || 'Unknown Medication',
            description: med.description || '',
            // Use enhanced logic for all fields
            dosage: dosageValue,
            time: timeValue,
            frequency: frequencyValue,
            startDate: startDate,
            endDate: endDate,
            timeOfDay: timeOfDayArray,
            notes: notesValue,
            pillType: pillType,
            isTaken: med.status === 'taken',
            lastTakenDays: lastTakenDays,
            sideEffects: med.side_effects || med.sideEffects || '',
            activeIngredient: med.active_ingredient || med.activeIngredient || '',
            medicationType: med.medication_type || med.medicationType || '',
            whenToTake: whenToTakeValue,
            remainingQuantity: remainingQty,
            refillDate: refillDateText,
            status: med.status || 'pending',
            unit: unitValue,
            color: color,
            // Database-specific fields
            take_with_food: med.take_with_food === true || med.take_with_food === 1,
            refill_reminder: hasRefillReminder,
            // Additional fields for better UI display
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            // Store complete schedule and inventory info if available
            scheduleInfo: scheduleInfo,
            inventoryInfo: inventoryInfo,
            // Tüm orijinal verileri de sakla
            rawData: med
          };
        });
        
        console.log(`Transformed ${transformedMedications.length} medications`);
          if (transformedMedications.length > 0) {
          setUserMedications(transformedMedications);
          setIsUsingMockData(false);
        } else {
          console.log('No medications returned from API, showing empty state');
          setUserMedications([]);
          setIsUsingMockData(false);
        }      } else {
        console.log('Failed to retrieve medications or empty response', medicationResponse);
        setError('Failed to load medications. Please try again or add a medication.');
        // Show empty state instead of mock data
        setUserMedications([]);
        setIsUsingMockData(false);
      }
    } catch (error) {
      console.error('Error loading medications:', error);
      
      // Enhanced error logging for debugging
      if (error.response) {
        console.error('Server error response:', error.response);
      } else if (error.request) {
        console.error('No response received:', error.request);
      }
        // Show a more descriptive error message
      setError(`Connection issue: ${error.message}. Please check your connection and try again.`);
      
      // Show empty state instead of mock data
      setUserMedications([]);
      setIsUsingMockData(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to load mock medication data when the API fails
  const useMockMedicationsData = () => {
    // Create mock medications for development/testing
    const mockMeds = [
      {
        id: 'mock-1',
        reminderMedId: 'reminder-mock-1',
        name: 'Atorvastatin',
        description: 'Cholesterol medication (statin)',
        dosage: '20mg',
        time: '08:00 am',
        frequency: 'Once daily',
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        timeOfDay: ['Morning'],
        notes: 'Take with water, with or without food',
        pillType: 'white',
        isTaken: false,
        lastTakenDays: 5,
        sideEffects: 'Muscle pain, headache',
        activeIngredient: 'Atorvastatin calcium',
        medicationType: 'Statin',
        whenToTake: 'Morning or evening',
        remainingQuantity: '28 tablets remaining',
        refillDate: `Refill by ${format(new Date(new Date().setDate(new Date().getDate() + 14)), 'MMMM d, yyyy')}`,
        status: 'pending',
        unit: 'tablet',
        color: '#FFFFFF'
      },
      {
        id: 'mock-2',
        reminderMedId: 'reminder-mock-2',
        name: 'Ibuprofen',
        description: 'NSAID pain reliever, anti-inflammatory',
        dosage: '400mg',
        time: '12:00 pm',
        frequency: 'As needed',
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        timeOfDay: ['Afternoon'],
        notes: 'Take with food to reduce stomach upset',
        pillType: 'blue',
        isTaken: false,
        lastTakenDays: 3,
        sideEffects: 'Stomach upset, dizziness',
        activeIngredient: 'Ibuprofen',
        medicationType: 'NSAID',
        whenToTake: 'With food',
        remainingQuantity: '15 tablets remaining',
        refillDate: '',
        status: 'pending',
        unit: 'tablet',
        color: '#45B3FE'
      },
      {
        id: 'mock-3',
        reminderMedId: 'reminder-mock-3',
        name: 'Vitamin D3',
        description: 'Vitamin supplement',
        dosage: '1000IU',
        time: '09:00 am',
        frequency: 'Daily',
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
        timeOfDay: ['Morning'],
        notes: '',
        pillType: 'orange',
        isTaken: true,
        lastTakenDays: 7,
        sideEffects: '',
        activeIngredient: 'Cholecalciferol',
        medicationType: 'Supplement',
        whenToTake: 'With a meal',
        remainingQuantity: '45 capsules remaining',
        refillDate: '',
        status: 'taken',
        unit: 'capsule',
        color: '#FFB95A'
      },
      {
        id: 'mock-4',
        reminderMedId: 'reminder-mock-4',
        name: 'Fluoxetine',
        description: 'Antidepressant (SSRI)',
        dosage: '20mg',
        time: '08:00 am',
        frequency: 'Once daily',
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
        timeOfDay: ['Morning'],
        notes: 'Take consistently at the same time each day',
        pillType: 'purple-white',
        isTaken: false,
        lastTakenDays: 6,
        sideEffects: 'Nausea, headache, insomnia',
        activeIngredient: 'Fluoxetine hydrochloride',
        medicationType: 'SSRI',
        whenToTake: 'Morning, with or without food',
        remainingQuantity: '32 capsules remaining',
        refillDate: `Refill by ${format(new Date(new Date().setDate(new Date().getDate() + 21)), 'MMMM d, yyyy')}`,
        status: 'pending',
        unit: 'capsule',
        color: '#6B5DFF'
      }
    ];
    
    setUserMedications(mockMeds);
    console.log('Using mock medication data:', mockMeds.length, 'medications loaded');
  };
  
  // Helper function to determine time of day based on time string
  const determinTimeOfDay = (timeString) => {
    if (!timeString) return ['Morning'];
    
    try {
      // Extract hour from time string (assuming format like "08:00 AM" or "14:00")
      let hour = 0;
      
      if (timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('pm')) {
        const timeComponents = timeString.split(' ');
        const timeParts = timeComponents[0].split(':');
        hour = parseInt(timeParts[0], 10);
        
        if (timeComponents[1].toLowerCase() === 'pm' && hour < 12) {
          hour += 12;
        }
      } else {
        // 24-hour format
        const timeParts = timeString.split(':');
        hour = parseInt(timeParts[0], 10);
      }
      
      // Determine time of day based on hour
      if (hour >= 5 && hour < 12) {
        return ['Morning'];
      } else if (hour >= 12 && hour < 17) {
        return ['Afternoon'];
      } else if (hour >= 17 && hour < 21) {
        return ['Evening'];
      } else {
        return ['Night'];
      }
    } catch (error) {
      console.log('Error parsing time:', error);
      return ['Morning']; // Default to morning if there's an error
    }
  };

  // Function to handle medication status change
  const handleMedicationStatus = async (medication, status) => {
    if (!token) {
      Alert.alert('Error', 'Authentication token missing. Please login again.');
      return;
    }
    
    if (!medication || !medication.reminderMedId) {
      console.error('Missing medication info:', medication);
      Alert.alert('Error', 'Cannot update medication status: Missing medication ID information');
      return;
    }
    
    try {
      setIsLoading(true);
      
      let response;
      if (status === 'taken') {
        response = await ReminderService.markAsTaken(token, medication.reminderMedId);
      } else if (status === 'skipped') {
        response = await ReminderService.markAsSkipped(token, medication.reminderMedId);
      }
      
      if (response && response.success) {
        // Update local state
        const updatedMedications = userMedications.map(med => {
          // Compare IDs with string conversion for safety
          const reminderMedIdMatches = String(med.reminderMedId) === String(medication.reminderMedId);
          
          if (reminderMedIdMatches) {
            return { ...med, status, isTaken: status === 'taken' };
          }
          return med;
        });
        
        setUserMedications(updatedMedications);
        
        Alert.alert(
          'Success', 
          `Medication marked as ${status}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', `Failed to update medication status. Please try again.`);
      }
    } catch (error) {
      console.error(`Error marking medication as ${status}:`, error);
      Alert.alert('Error', `Failed to update medication status: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to reset medication status
  const handleResetMedicationStatus = async (medication) => {
    if (!token) {
      Alert.alert('Error', 'Authentication token missing. Please login again.');
      return;
    }
    
    if (!medication || !medication.reminderMedId) {
      console.error('Missing medication info:', medication);
      Alert.alert('Error', 'Cannot reset medication status: Missing medication ID information');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const response = await ReminderService.resetMedicationStatus(token, medication.reminderMedId);
      
      if (response && response.success) {
        // Update local state
        const updatedMedications = userMedications.map(med => {
          // Compare IDs with string conversion for safety
          const reminderMedIdMatches = String(med.reminderMedId) === String(medication.reminderMedId);
          
          if (reminderMedIdMatches) {
            return { ...med, status: 'pending', isTaken: false };
          }
          return med;
        });
        
        setUserMedications(updatedMedications);
        
        Alert.alert(
          'Success', 
          'Medication status reset to pending',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to reset medication status. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting medication status:', error);
      Alert.alert('Error', `Failed to reset medication status: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date function
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };  
    // Function to render pill image based on pill type  
  const renderPillImage = (pillType) => {
    // Default styles
    const containerStyle = [styles.pillImageContainer];
    
    // Handle different pill type values
    // Log the pill type for debugging
    console.log(`Rendering pill image for pillType: ${pillType}`);
    
    switch(pillType) {
      case 'purple-white':
      case 'antidepressant':
      case 'antidep':
        return (
          <View style={containerStyle}>
            <View style={[styles.pillCapsule, { backgroundColor: '#6B5DFF' }]}
            >
              <View style={[styles.pillSpeckles]}></View>
            </View>
          </View>
        );
      case 'blue':
      case 'general':
        return (
          <View style={containerStyle}>
            <View style={[styles.pillCapsule, { backgroundColor: '#45B3FE' }]}></View>
          </View>
        );
      case 'orange':
      case 'hypertension':
        return (
          <View style={containerStyle}>
            <View style={[styles.pillCapsule, { backgroundColor: '#FFB95A' }]}></View>
          </View>
        );
      case 'white':
      case 'pill':
      default:
        return (
          <View style={containerStyle}>
            <View style={[styles.pillCapsule, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0' }]}></View>
          </View>
        );
    }
  };
  // Render progress dots
  const renderProgressDots = (days, accentColor = '#6B5DFF') => {
    const dots = [];
    for (let i = 0; i < 7; i++) {
      dots.push(
        <View 
          key={i} 
          style={[
            styles.progressDot, 
            i < days ? [styles.activeDot, { backgroundColor: accentColor }] : styles.inactiveDot
          ]} 
        />
      );
    }
    return dots;
  };  // Initialize refs for each medication card
  useEffect(() => {
    userMedications.forEach((med) => {
      if (!carouselScrollRefs.current[med.id]) {
        carouselScrollRefs.current[med.id] = React.createRef();
      }
      if (!currentCardPage[med.id]) {
        setCurrentCardPage(prev => ({ ...prev, [med.id]: 0 }));
      }
    });
  }, [userMedications]);
  // Load all medications when component mounts or on token change
  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      setError(null);
        // If no token available, show empty state
      if (!token) {
        console.log('No authentication token available, showing empty state');
        setUserMedications([]);
        setIsUsingMockData(false);
        setIsLoading(false);
        return;
      }
      
      try {
        // Check API connectivity first
        console.log('Starting medication data initialization, checking connectivity...');
        const isConnected = await checkAPIConnectivity();
        
        if (isConnected) {
          console.log('Connection successful, loading medications from API');
          await loadAllMedications();
        } else {
          console.log('Connection check failed, using mock data');
          setError('Unable to connect to the medication database. Using sample data.');
          useMockMedicationsData();
          setIsUsingMockData(true);
        }
      } catch (e) {
        console.error('Error during medication data initialization:', e);
        setError(`Error initializing: ${e.message}. Using sample data.`);
        useMockMedicationsData();
        setIsUsingMockData(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [token]);

  // Handle page change for medication cards
  const handlePageChange = (itemId, pageIndex) => {
    setCurrentCardPage(prev => ({ ...prev, [itemId]: pageIndex }));
  };

  // Function to scroll to a specific page
  const scrollToPage = (itemId, pageIndex) => {
    if (carouselScrollRefs.current[itemId]?.current) {
      carouselScrollRefs.current[itemId].current.scrollTo({ 
        x: pageIndex * (SCREEN_WIDTH - 30),
        animated: true
      });
    }
  };  // Render card page dots
  const renderPaginationDots = (itemId, totalDots = 5, accentColor = '#6B5DFF') => {
    const currentPage = currentCardPage[itemId] || 0;
    
    return (
      <View style={styles.paginationDotsContainer}>
        {Array.from({ length: totalDots }).map((_, i) => (
          <TouchableOpacity 
            key={i} 
            style={[
              styles.paginationDot, 
              i === currentPage && [styles.activePaginationDot, { backgroundColor: accentColor }]
            ]} 
            onPress={() => scrollToPage(itemId, i)}
          />
        ))}
      </View>
    );
  };
  // Render page 1 of medication card (main view)  
  const renderCardPage1 = (item, accentColor) => {
    return (
      <View style={styles.cardPage}>
        <View style={styles.medicationCardHeader}>
          {/* Timing indicators */}
          <View style={styles.timeIndicators}>
            <View style={styles.timeContainer}>
              <Ionicons name="time-outline" size={16} color={accentColor} style={styles.timeIcon} />
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
            
            <View style={styles.timeOfDayTags}>
              {item.timeOfDay && item.timeOfDay.map((time, idx) => (
                <View key={idx} style={[styles.timeOfDayTag, { backgroundColor: `${accentColor}20` }]}>
                  <Text style={[styles.timeOfDayTagText, { color: accentColor }]}>{time}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Check mark for taken medication */}
          {item.isTaken && (
            <View style={styles.takenIndicator}>
              <View style={[styles.takenIconCircle, { backgroundColor: `${accentColor}20`, borderColor: accentColor }]}>
                <Ionicons name="checkmark" size={16} color={accentColor} />
              </View>
              <Text style={[styles.takenText, { color: accentColor }]}>Taken</Text>
            </View>
          )}
        </View>

        <View style={styles.medicationCardContent}>
          {/* Medication name and info */}
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{item.name}</Text>
            <Text style={styles.medicationTimeAndDosage}>
              {item.dosage} · {item.unit || 'dose'}
            </Text>
            
            <Text numberOfLines={2} style={styles.medicationDesc}>
              {item.medicationType || 'Medication'} 
              {item.whenToTake ? ` · Take ${item.whenToTake}` : ''}
            </Text>
          </View>
          
          {/* Pill Image */}
          <View style={styles.pillImageContainer}>
            {renderPillImage(item.pillType, 'large')}
          </View>
        </View>
        
        {/* Last taken indicator & progress dots */}
        <View style={styles.medicationFooter}>
          <Text style={styles.lastTakenText}>Last week</Text>
          <View style={styles.progressDotsContainer}>
            {renderProgressDots(item.lastTakenDays, accentColor)}
          </View>
        </View>
      </View>
    );  };
  
  // Render page 2 of medication card (details view)
  const renderCardPage2 = (item) => {
    const pillTypeLabel = item.pillType ? item.pillType.charAt(0).toUpperCase() + item.pillType.slice(1) : 'White';
    
    return (
      <View style={styles.cardPage}>
        <Text style={styles.cardPageTitle}>Medication Info</Text>
        
        <View style={styles.cardDetailsContainer}>
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Type</Text>
              <Text style={styles.cardDetailValue}>{item.medicationType || 'Not specified'}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Active Ingredient</Text>
              <Text style={styles.cardDetailValue}>{item.activeIngredient || 'Not specified'}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Dosage</Text>
              <Text style={styles.cardDetailValue}>{item.dosage || 'Not specified'}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Unit</Text>
              <Text style={styles.cardDetailValue}>{item.unit || 'tablet'}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailFull}>
              <Text style={styles.cardDetailLabel}>Description</Text>
              <Text style={styles.cardDetailValue}>{item.description || 'No description available'}</Text>
            </View>
          </View>
          
          <View style={[styles.cardDetailRow, styles.pillTypeIndicator]}>
            <View style={styles.pillTypeDisplay}>
              {renderPillImage(item.pillType)}
              <Text style={styles.pillTypeText}>{pillTypeLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Render page 3 of medication card (inventory view)
  const renderCardPage3 = (item) => {
    // Convert whenToTake value to a human-readable format
    let whenToTakeFormatted = 'Not specified';
    switch(item.whenToTake) {
      case 'before_meal':
        whenToTakeFormatted = 'Before meals';
        break;
      case 'with_meal':
        whenToTakeFormatted = 'With meals';
        break;
      case 'after_meal':
        whenToTakeFormatted = 'After meals';
        break;
      case 'empty_stomach':
        whenToTakeFormatted = 'On empty stomach';
        break;
      default:
        whenToTakeFormatted = item.whenToTake || 'Not specified';
    }
    
    // Format dates properly
    const startDateFormatted = item.startDate ? formatDate(item.startDate) : 'Not set';
    const endDateFormatted = item.endDate ? formatDate(item.endDate) : 'Not set';
    
    return (
      <View style={styles.cardPage}>
        <Text style={styles.cardPageTitle}>Medication Schedule</Text>
        
        <View style={styles.cardDetailsContainer}>
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Frequency</Text>
              <Text style={styles.cardDetailValue}>{item.frequency || 'Daily'}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>When to Take</Text>
              <Text style={styles.cardDetailValue}>{whenToTakeFormatted}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Start Date</Text>
              <Text style={styles.cardDetailValue}>{startDateFormatted}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>End Date</Text>
              <Text style={styles.cardDetailValue}>{endDateFormatted}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Time of Day</Text>
              <Text style={styles.cardDetailValue}>
                {item.timeOfDay && item.timeOfDay.length > 0 
                  ? item.timeOfDay.join(', ') 
                  : 'Not specified'}
              </Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Specific Time</Text>
              <Text style={styles.cardDetailValue}>{item.time || 'Not set'}</Text>
            </View>
          </View>
          
          <View style={styles.cardActionOptions}>
            {item.reminderMedId && item.status === 'pending' && (
              <TouchableOpacity 
                style={[styles.quickActionButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handleMedicationStatus(item, 'taken')}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.quickActionText, { color: '#FFFFFF' }]}>Mark Taken</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  // Render page 4 of medication card (inventory status)
  const renderCardPage4 = (item) => {
    // Extract numeric quantity from remainingQuantity string
    let numericQuantity = 0;
    if (item.remainingQuantity) {
      const match = item.remainingQuantity.toString().match(/(\d+)/);
      if (match && match[1]) {
        numericQuantity = parseInt(match[1]);
      }
    }
    
    // Calculate fill percentage for stock bar
    const fillPercentage = Math.min(numericQuantity, 100);
    
    return (
      <View style={styles.cardPage}>
        <Text style={styles.cardPageTitle}>Inventory Status</Text>
        
        <View style={styles.cardDetailsContainer}>
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Remaining</Text>
              <Text style={styles.cardDetailValue}>{item.remainingQuantity || 'Not specified'}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Unit</Text>
              <Text style={styles.cardDetailValue}>{item.unit || 'tablet'}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Refill Date</Text>
              <Text style={styles.cardDetailValue}>{item.refillDate || 'Not specified'}</Text>
            </View>
            <View style={styles.cardDetailItem}>
              <Text style={styles.cardDetailLabel}>Refill Reminder</Text>
              <Text style={styles.cardDetailValue}>{item.refill_reminder ? 'Enabled' : 'Disabled'}</Text>
            </View>
          </View>
          
          <View style={styles.stockIndicator}>
            <View style={styles.stockBar}>
              <View 
                style={[
                  styles.stockBarFill, 
                  { width: `${fillPercentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.stockText}>{numericQuantity} {item.unit || 'tablets'} remaining</Text>
          </View>
        </View>      </View>
    );
  };
  
  // Render page 5 of medication card (medical notes)  
  const renderCardPage5 = (item) => {
    // Format notes and side effects for better display
    const notesValue = item.notes || 'No notes available';
    const sideEffectsValue = item.sideEffects || 'None specified';
    
    // Check if item exists in the medications array to get the correct index
    const medicationIndex = userMedications.findIndex(med => med.id === item.id);
    
    return (
      <View style={styles.cardPage}>
        <Text style={styles.cardPageTitle}>Medical Notes</Text>
        
        <View style={styles.cardDetailsContainer}>
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailFull}>
              <Text style={styles.cardDetailLabel}>Notes</Text>
              <Text style={styles.cardDetailValue}>{notesValue}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailFull}>
              <Text style={styles.cardDetailLabel}>Side Effects</Text>
              <Text style={styles.cardDetailValue}>{sideEffectsValue}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetailRow}>
            <View style={styles.cardDetailFull}>
              <Text style={styles.cardDetailLabel}>Take With Food</Text>
              <Text style={styles.cardDetailValue}>
                {item.take_with_food ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
          
          <View style={styles.cardActionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeleteMedication(medicationIndex)}
            >
              <Ionicons name="trash-outline" size={16} color="#FF5A5A" />
              <Text style={[styles.actionButtonText, { color: '#FF5A5A' }]}>Delete</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#3498DB' }]}
              onPress={() => handleEditMedication(medicationIndex)}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>    );
  };
  // Create a shared animated value for all cards
  const cardScaleAnimValue = new Animated.Value(1);

  // Animation functions that don't use hooks
  const onCardPressIn = () => {
    Animated.timing(cardScaleAnimValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
    
  const onCardPressOut = () => {
    Animated.timing(cardScaleAnimValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  
  // Render an individual medication item  
  const renderMedicationItem = (item, index) => {
    // Initialize ref for this card if not already done
    if (!carouselScrollRefs.current[item.id]) {
      carouselScrollRefs.current[item.id] = React.createRef();
    }
    
    // Get the current page for this card
    const cardPage = currentCardPage[item.id] || 0;
    
    // Determine card accent color based on pill type
    let accentColor;
    switch(item.pillType || 'white') {
      case 'purple-white':
        accentColor = '#6B5DFF';
        break;
      case 'blue':
        accentColor = '#45B3FE';
        break;
      case 'orange':
        accentColor = '#FFB95A';
        break;
      default:
        accentColor = '#6B5DFF';
    };      return (
      <Animated.View
        style={[
          styles.medicationCard,
          { 
            backgroundColor: '#FFFFFF',
            transform: [{ scale: cardScaleAnimValue }],
            borderLeftColor: accentColor,
            borderLeftWidth: 5,
          }
        ]}
      >
        <View
          style={styles.cardTouchable}
          onTouchStart={onCardPressIn}
          onTouchEnd={onCardPressOut}
        >
          <ScrollView
            ref={carouselScrollRefs.current[item.id]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - 30}
            snapToAlignment="center"
            onMomentumScrollEnd={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const pageIndex = Math.round(offsetX / (SCREEN_WIDTH - 30));
              handlePageChange(item.id, pageIndex);
            }}
            contentContainerStyle={styles.cardScrollContainer}
          >
            <View style={styles.cardScrollPage}>
              {renderCardPage1(item, accentColor)}
            </View>
            
            <View style={styles.cardScrollPage}>
              {renderCardPage2(item, accentColor)}
            </View>
            
            <View style={styles.cardScrollPage}>
              {renderCardPage3(item, accentColor)}
            </View>
            
            <View style={styles.cardScrollPage}>
              {renderCardPage4(item, accentColor)}
            </View>
            
            <View style={styles.cardScrollPage}>
              {renderCardPage5(item, accentColor)}
            </View>          </ScrollView>
        </View>

        {/* Pagination dots */}
        {renderPaginationDots(item.id, 5, accentColor)}
      
        {/* Edit button */}
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: accentColor }]}
          onPress={() => handleEditMedication(index)}
        >
          <Ionicons name="pencil" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  /**
   * Prepares medication data to be compatible with the backend schema.
   * This function cleans up the data, maps fields correctly, and removes fields that don't exist in the database.
   * @param {Object} medicationData - The raw medication data from the form
  
   * @returns {Object} - The clean medication data ready for the backend
   */  const prepareCompatibleMedicationData = (medicationData) => {
    // Create a new object to avoid mutating the original
    const cleanedData = { ...medicationData };
    
    // Yeni güncellenmiş veritabanı alanlarını doğrudan kullan
    // 'strength' ve 'dosage' alanlarını birlikte kullan (database artık ikisini de destekliyor)
    if (cleanedData.dosage) {
      // Dosage alanını doğrudan kullan
      cleanedData.dosage = cleanedData.dosage;
      // Ama eski kod için strength alanını da güncelleyelim 
      cleanedData.strength = cleanedData.dosage;
    }
    
    // İlaç türünü doğrudan pill_type alanına aktar (yeni eklendi)
    if (cleanedData.pillType) {
      cleanedData.pill_type = cleanedData.pillType;
    }
    
    // time_of_day alanı için (yeni eklendi)
    if (cleanedData.timeOfDay && Array.isArray(cleanedData.timeOfDay)) {
      cleanedData.time_of_day = cleanedData.timeOfDay.join(", ");
    }
      // when_to_take bilgisinden take_with_food boolean değerini ayarla
    if (cleanedData.whenToTake) {
      cleanedData.when_to_take = cleanedData.whenToTake;
      // Yemekle alınıp alınmadığını belirleme
      cleanedData.take_with_food = 
        cleanedData.whenToTake === 'with_meal' || 
        cleanedData.whenToTake === 'after_meal';
        
      // when_to_take alanını notlara da ekle (veritabanı hatası olması durumunda)
      if (!cleanedData.notes) cleanedData.notes = '';
      if (!cleanedData.notes.includes('When to take:')) {
        cleanedData.notes += cleanedData.notes ? ` (When to take: ${cleanedData.whenToTake})` : `When to take: ${cleanedData.whenToTake}`;
      }
      
      // Ayrıca special_instructions alanına da ekle (geriye dönük uyumluluk için)
      if (!cleanedData.special_instructions) cleanedData.special_instructions = '';
      if (!cleanedData.special_instructions.includes('When to take:')) {
        cleanedData.special_instructions += cleanedData.special_instructions ? 
          ` (When to take: ${cleanedData.whenToTake})` : 
          `When to take: ${cleanedData.whenToTake}`;
      }
    }
    
    // Icon ve renk alanları
    if (!cleanedData.icon_type && cleanedData.pillType) {
      cleanedData.icon_type = 
        cleanedData.pillType === 'purple-white' ? 'antidepressant' :
        cleanedData.pillType === 'blue' ? 'general' :
        cleanedData.pillType === 'orange' ? 'hypertension' : 'pill';
    }
    
    // Icon alanını ayarla
    if (!cleanedData.icon && cleanedData.icon_type) {
      cleanedData.icon = cleanedData.icon_type;
    }

    // Renk belirtilmemişse belirleme
    if (!cleanedData.color) {
      const iconInfo = Object.values(medicationIcons).find(icon => 
        icon.name === cleanedData.icon_type || icon.name === cleanedData.icon
      );
      if (iconInfo) {
        cleanedData.color = iconInfo.color || '#FFFFFF';
      } else {
        cleanedData.color = '#FFFFFF'; // Default color
      }
    }      // Tarihleri uygun formata dönüştürme - her zaman string'e dönüştür
    try {
      if (cleanedData.startDate) {
        // Always format as string, regardless of current type
        const startDateObj = cleanedData.startDate instanceof Date 
          ? cleanedData.startDate
          : new Date(cleanedData.startDate);
        
        // Use vanilla JavaScript formatting to ensure consistency
        const year = startDateObj.getFullYear();
        const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(startDateObj.getDate()).padStart(2, '0');
        cleanedData.start_date = `${year}-${month}-${day}`;
        
        console.log(`Formatted start_date: ${cleanedData.startDate} -> ${cleanedData.start_date}`);
      }
    } catch (dateError) {
      console.error('Error formatting startDate:', dateError);
    }
    
    try {
      if (cleanedData.endDate) {
        // Always format as string, regardless of current type
        const endDateObj = cleanedData.endDate instanceof Date 
          ? cleanedData.endDate
          : new Date(cleanedData.endDate);
        
        // Use vanilla JavaScript formatting to ensure consistency
        const year = endDateObj.getFullYear();
        const month = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(endDateObj.getDate()).padStart(2, '0');
        cleanedData.end_date = `${year}-${month}-${day}`;
        
        console.log(`Formatted end_date: ${cleanedData.endDate} -> ${cleanedData.end_date}`);
      }
    } catch (dateError) {
      console.error('Error formatting endDate:', dateError);
    }
    
    // Ensure we always remove the original date fields to avoid confusion
    delete cleanedData.startDate;
    delete cleanedData.endDate;
    
    if (cleanedData.refillDate) {
      // Always format as string, regardless of current type
      cleanedData.refill_date = cleanedData.refillDate instanceof Date 
        ? format(cleanedData.refillDate, 'yyyy-MM-dd')
        : format(new Date(cleanedData.refillDate), 'yyyy-MM-dd');
      
      // Refill hatırlatıcısını aktif et
      cleanedData.refill_reminder = true;
    }
    
    // Sayısal değerler
    if (cleanedData.remainingQuantity) {
      cleanedData.remaining_quantity = parseInt(cleanedData.remainingQuantity) || 0;
    }
    
    // Diğer alan eşleştirmeleri
    if (cleanedData.medicationType) {
      cleanedData.medication_type = cleanedData.medicationType;
    }
    
    if (cleanedData.sideEffects) {
      cleanedData.side_effects = cleanedData.sideEffects;
    }
    
    if (cleanedData.activeIngredient) {
      cleanedData.active_ingredient = cleanedData.activeIngredient;
    }
    
    if (cleanedData.notes !== undefined) {
      // Notları notes alanına ekle (güncellenmiş veritabanı ile uyumlu)
      cleanedData.notes = cleanedData.notes;
      // Geriye dönük uyumluluk için
      cleanedData.instructions = cleanedData.notes;
    }
    
    // Frekans bilgisini doğrudan aktar
    if (cleanedData.frequency) {
      cleanedData.frequency = cleanedData.frequency;
    }
      // Ensure we have start_date and end_date fields properly set before removing startDate/endDate fields
    // This guarantees we always send these critical fields in the right format
    if (cleanedData.startDate && !cleanedData.start_date) {
      cleanedData.start_date = cleanedData.startDate instanceof Date 
        ? format(cleanedData.startDate, 'yyyy-MM-dd')
        : format(new Date(cleanedData.startDate), 'yyyy-MM-dd');
    }
    
    if (cleanedData.endDate && !cleanedData.end_date) {
      cleanedData.end_date = cleanedData.endDate instanceof Date 
        ? format(cleanedData.endDate, 'yyyy-MM-dd')
        : format(new Date(cleanedData.endDate), 'yyyy-MM-dd');
    }
    
    // Log date fields specifically for debugging
    if (cleanedData.startDate || cleanedData.start_date) {
      console.log('Date fields before sending:', {
        startDate: cleanedData.startDate,
        start_date: cleanedData.start_date,
        endDate: cleanedData.endDate,
        end_date: cleanedData.end_date
      });
    }
    
    // Remove fields that might not exist in the backend or fields that have been mapped
    // This is safer than sending fields that don't exist
    const fieldsToRemove = [
      'specific_time', 
      'medicationType',
      'whenToTake',
      'sideEffects',
      'activeIngredient',
      'startDate',  // Remove after ensuring start_date is set
      'endDate',    // Remove after ensuring end_date is set
      'refillDate',
      'remainingQuantity',
      'pillType',
      'isTaken',
      'lastTakenDays',
      'timeOfDay'
    ];
    
    fieldsToRemove.forEach(field => {
      if (cleanedData[field] !== undefined) {
        delete cleanedData[field];
      }
    });
      // Double-check if date fields are properly set before returning
    console.log('FINAL DATE CHECKS:', {
      start_date: cleanedData.start_date || 'MISSING',
      end_date: cleanedData.end_date || 'MISSING'
    });
    
    console.log('Güncellenmiş veritabanı için hazırlanan veri:', JSON.stringify(cleanedData));
    return cleanedData;
  };

  /**
   * Create or update a reminder for a medication
   * @param {object} medicationData - The medication data 
   * @param {string} medicationId - The medication ID from the database response
   */
  const createOrUpdateReminder = async (medicationData, medicationId) => {
    try {
      console.log('Creating reminder for medication:', medicationId);
      
      // Format current date to YYYY-MM-DD
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      
      // Determine the scheduled date - for today's medications
      let scheduledDate = currentDate;
      
      // If we have a start_date, use it
      if (medicationData.start_date) {
        scheduledDate = medicationData.start_date;
        
        // If the date is an object, format it properly
        if (typeof scheduledDate !== 'string') {
          scheduledDate = format(scheduledDate, 'yyyy-MM-dd');
        }
      }
      
      console.log(`Creating reminder for date: ${scheduledDate}`);
      
      // Get the medication time
      const medicationTime = medicationData.time || '09:00';
      
      // Create reminder data - making sure we match exactly what the backend expects
      const reminderData = {
        title: `Take ${medicationData.name}`,
        description: medicationData.description || '',
        date: scheduledDate,
        time: medicationTime,
        medications: [
          {
            medicationId: medicationId,
            scheduleTime: medicationTime
          }
        ]
      };
      
      console.log('Creating reminder with data:', JSON.stringify(reminderData));
      
      const response = await ReminderService.createReminder(token, reminderData);
      
      if (response && response.success) {
        console.log('Reminder created successfully:', JSON.stringify(response.data));
        return true;
      } else {
        // Try with a simplified version if the first attempt failed
        console.error('Failed to create reminder:', JSON.stringify(response));
        
        // Create a simplified reminder as fallback
        const simplifiedReminder = {
          title: `Take ${medicationData.name}`,
          date: scheduledDate,
          medications: [{ 
            medicationId: medicationId,
            scheduleTime: medicationTime
          }]
        };
        
        console.log('Trying simplified reminder:', JSON.stringify(simplifiedReminder));
        const fallbackResponse = await ReminderService.createReminder(token, simplifiedReminder);
        
        if (fallbackResponse && fallbackResponse.success) {
          console.log('Simplified reminder created successfully');
          return true;
        } else {
          console.error('Failed to create even simplified reminder:', JSON.stringify(fallbackResponse));
          return false;
        }
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      return false;
    }
  };

  /**
   * Debug function to test reminders
   */
  const debugReminders = async () => {
    try {
      console.log('Running reminder debug...');
      const response = await ReminderService.debugReminders(token);
      
      if (response && response.success) {
        console.log('Reminder debug response:', JSON.stringify(response.data, null, 2));
        Alert.alert(
          'Reminder Debug',
          `Found ${response.data.summary.reminderCount} reminders and ${response.data.summary.medicationLinkCount} medication links.`,
          [
            { text: 'OK' }
          ]
        );
      } else {
        console.error('Reminder debug failed:', JSON.stringify(response));
        Alert.alert('Debug Failed', 'Could not get reminder debug information.');
      }
    } catch (error) {
      console.error('Error in debugReminders:', error);
      Alert.alert('Error', 'Failed to run reminder debug.');
    }  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F8FA" />
      <CustomHeader title="All Medications" navigation={navigation} />
      
      {/* Debug button (only in development) */}
      {__DEV__ && (
        <TouchableOpacity 
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: 5,
            borderRadius: 5,
            zIndex: 1000
          }}
          onPress={debugReminders}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>Debug</Text>
        </TouchableOpacity>
      )}
      
      {/* Search and Add Section */}
      <View style={styles.searchContainer}>
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="search" size={20} color="#7F8C8D" />
          <Text style={styles.searchPlaceholder}>Search medications...</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setFormModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* User Medications List */}
      <View style={styles.medicationsContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Medications</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={retryConnection}
            disabled={isLoading}
          >
            <Ionicons name="refresh" size={20} color="#3498DB" />
          </TouchableOpacity>
        </View>        {(isUsingMockData || (__DEV__ && userMedications.length > 0 && 
          (userMedications[0]?.id?.toString().startsWith('mock-')))) && (
          <View style={styles.mockDataBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.mockDataText}>
              {__DEV__ ? "DEVELOPMENT MODE - Showing sample data" : "Showing sample data - Not connected to database"}
            </Text>
          </View>
        )}
        
        {isLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3498DB" />
            <Text style={styles.loadingText}>Loading medications...</Text>
          </View>        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={60} color="#FF5A5A" />
            <Text style={styles.errorTitle}>Connection Issue</Text>
            <Text style={styles.errorText}>{error}</Text>            <View style={styles.errorButtonsRow}>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={retryConnection}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              {__DEV__ && (
                <TouchableOpacity 
                  style={[styles.retryButton, {backgroundColor: '#4CAF50'}]}
                  onPress={() => {
                    setError(null);
                    useMockMedicationsData();
                    setIsUsingMockData(true);
                  }}
                >
                  <Ionicons name="document-outline" size={18} color="#FFFFFF" style={{marginRight: 6}} />
                  <Text style={styles.retryButtonText}>Use Sample Data</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>        ) : userMedications.length > 0 ? (
          <View style={styles.medicationsScrollContainer}>
            <FlatList
              data={userMedications}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.medicationsList}
              renderItem={({ item, index }) => renderMedicationItem(item, index)}
              snapToAlignment="start"
              decelerationRate="fast"
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="medkit" size={50} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>
              No medications found
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tap the + button to add your first medication
            </Text>
            <TouchableOpacity
              style={styles.emptyStateButton}
              onPress={() => setFormModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{marginRight: 8}} />
              <Text style={styles.emptyStateButtonText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search Medication Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Medications</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#7F8C8D" />
              <TextInput
                style={styles.searchInput}
                placeholder="Type medication name..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#7F8C8D" />
                </TouchableOpacity>
              )}
            </View>
            
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.searchResultItem}
                  onPress={() => handleMedicationSelect(item)}
                >
                  <Text style={styles.searchResultName}>{item.name}</Text>
                  <Text style={styles.searchResultDesc}>{item.description}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length > 0 ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No medications found</Text>
                  </View>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>

      {/* Add/Edit Medication Form Modal */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.formModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode ? 'Edit Medication' : 'Add New Medication'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.formScrollView}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Medication Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Medication name"
                  value={newMedication.name}
                  onChangeText={(text) => setNewMedication({...newMedication, name: text})}
                />
              </View>
                <View style={styles.formField}>
                <Text style={styles.formLabel}>Dosage *</Text>
                <FormDropdown
                  label="Dosage"
                  options={medicationOptions.dosages}
                  value={newMedication.dosage}
                  placeholder="Select dosage"
                  onSelect={(value) => {
                    if (value === 'custom') {
                      // Show input dialog for custom dosage
                      Alert.prompt(
                        "Custom Dosage",
                        "Enter the exact dosage (e.g. 125mg, 2.5ml)",
                        [
                          {
                            text: "Cancel",
                            style: "cancel"
                          },
                          {
                            text: "Save",
                            onPress: text => setNewMedication({...newMedication, dosage: text})
                          }
                        ],
                        "plain-text",
                        newMedication.dosage !== 'custom' ? newMedication.dosage : ""
                      );
                    } else {
                      setNewMedication({...newMedication, dosage: value});
                    }
                  }}
                />
              </View>
                <FormDropdown
                label="Frequency"
                options={medicationOptions.frequencies}
                value={newMedication.frequency}
                placeholder="Select frequency"
                onSelect={(value) => setNewMedication({...newMedication, frequency: value})}
              />
              
              <View style={styles.formRow}>                <View style={[styles.formField, { flex: 1, marginRight: 5 }]}>
                  <FormDropdown
                    label="Time"
                    options={medicationOptions.times}
                    value={newMedication.time}
                    placeholder="Select time"
                    onSelect={(value) => setNewMedication({...newMedication, time: value})}
                  />
                </View>
                
                <View style={[styles.formField, { flex: 1, marginLeft: 5 }]}>
                  <FormDropdown
                    label="Unit"
                    options={medicationOptions.units}
                    value={newMedication.unit}
                    placeholder="Select unit"
                    onSelect={(value) => setNewMedication({...newMedication, unit: value})}
                  />
                </View>
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Time of Day</Text>
                <View style={styles.timePickerContainer}>
                  {['Morning', 'Afternoon', 'Evening', 'Night'].map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timePickerOption,
                        newMedication.timeOfDay.includes(time) && styles.timePickerSelected
                      ]}
                      onPress={() => {
                        const updatedTimes = newMedication.timeOfDay.includes(time)
                          ? newMedication.timeOfDay.filter(t => t !== time)
                          : [...newMedication.timeOfDay, time];
                        setNewMedication({...newMedication, timeOfDay: updatedTimes});
                      }}
                    >
                      <Text style={[
                        styles.timePickerText,
                        newMedication.timeOfDay.includes(time) && styles.timePickerTextSelected
                      ]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
                <View style={styles.formField}>
                <Text style={styles.formLabel}>Pill Type</Text>
                <View style={styles.pillTypeContainer}>
                  {[
                    { type: 'white', label: 'White' },
                    { type: 'blue', label: 'Blue' },
                    { type: 'orange', label: 'Orange' },
                    { type: 'purple-white', label: 'Purple/White' }
                  ].map((pill) => (
                    <TouchableOpacity
                      key={pill.type}
                      style={[
                        styles.pillTypeOption,
                        newMedication.pillType === pill.type && styles.pillTypeSelected
                      ]}                      onPress={() => {
                        // Apply the pill type change and also update the related icon and color fields
                        let iconType = 'pill';
                        let color = '#FFFFFF';
                        let iconName = 'pill';
                        
                        switch(pill.type) {
                          case 'purple-white':
                            iconType = 'antidepressant';
                            iconName = 'antidepressant';
                            color = '#6B5DFF';
                            break;
                          case 'blue':
                            iconType = 'general';
                            iconName = 'general';
                            color = '#45B3FE';
                            break;
                          case 'orange':
                            iconType = 'hypertension';
                            iconName = 'hypertension';
                            color = '#FFB95A';
                            break;
                          default:
                            iconType = 'pill';
                            color = '#FFFFFF';
                        }
                          setNewMedication({
                          ...newMedication, 
                          pillType: pill.type,
                          icon: iconName,
                          icon_type: iconType,
                          color: color,
                          // Adding pill_type for backend compatibility
                          pill_type: pill.type
                        });
                        
                        console.log(`Pill type selected: ${pill.type}, Icon: ${iconName}, Color: ${color}`);
                      }}
                    >
                      {renderPillImage(pill.type)}
                      <Text style={[
                        styles.pillTypeText,
                        newMedication.pillType === pill.type && styles.pillTypeTextSelected
                      ]}>
                        {pill.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Add any special instructions or notes"
                  value={newMedication.notes}
                  onChangeText={(text) => setNewMedication({...newMedication, notes: text})}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <Text style={styles.formSectionHeader}>Additional Details</Text>
                            
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Medication Type</Text>
                <FormDropdown
                  options={medicationOptions.medicationTypes}
                  value={newMedication.medicationType}
                  onSelect={(value) => setNewMedication({...newMedication, medicationType: value})}
                  placeholder="Select medication type"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Active Ingredient</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Active ingredient"
                  value={newMedication.activeIngredient}
                  onChangeText={(text) => setNewMedication({...newMedication, activeIngredient: text})}
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>When to Take</Text>
                <FormDropdown
                  options={medicationOptions.whenToTake}
                  value={newMedication.whenToTake}
                  onSelect={(value) => setNewMedication({...newMedication, whenToTake: value})}
                  placeholder="Select when to take"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Side Effects</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Possible side effects"
                  value={newMedication.sideEffects}
                  onChangeText={(text) => setNewMedication({...newMedication, sideEffects: text})}
                  multiline
                  numberOfLines={2}
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Remaining Quantity</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 30"
                  value={newMedication.remainingQuantity}
                  onChangeText={(text) => setNewMedication({...newMedication, remainingQuantity: text})}
                  keyboardType="numeric"
                />
              </View>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Refill Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Refill by July 15, 2025"
                  value={newMedication.refillDate}
                  onChangeText={(text) => setNewMedication({...newMedication, refillDate: text})}
                />
              </View>
            </ScrollView>
            
            <View style={styles.formActions}>
              <Button
                mode="contained"
                onPress={handleSaveMedication}
                style={styles.saveButton}
                labelStyle={styles.saveButtonText}
                loading={loading}
                disabled={loading}
              >
                {editMode ? 'Update Medication' : 'Save Medication'}
              </Button>
            </View>
          </View>        </KeyboardAvoidingView>
      </Modal>
    </View>  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    position: 'relative',
  },
  dateSelector: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateSelectorContent: {
    paddingHorizontal: 15,
  },
  dayItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 70,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  selectedDayItem: {
    backgroundColor: '#3498DB',
  },
  dayText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#7F8C8D',
  },  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 15,
    marginBottom: 5,
  },
  errorText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  errorButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
  },
  searchPlaceholder: {
    color: '#7F8C8D',
    fontSize: 16,
    marginLeft: 10,
  },
  addButton: {
    backgroundColor: '#3498DB',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },  medicationsContainer: {
    flex: 1,
    paddingTop: 15,
    paddingHorizontal: 15,
  },
  medicationsScrollContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 15,
  },
  medicationsList: {
    paddingBottom: 10,
  },  medicationCard: {
    width: '100%',
    height: 160, // Increased height for more content
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 15,
    padding: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: 5,
    borderLeftColor: '#6B5DFF',
  },
  cardTouchable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cardScrollContainer: {
    flexGrow: 1,
  },
  cardScrollPage: {
    width: SCREEN_WIDTH - 30,
  },
  cardPage: {
    flex: 1,
    padding: 15,
    backgroundColor: 'transparent',
  },
  medicationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  timeIcon: {
    marginRight: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#2C3E50',
    fontWeight: '600',
  },
  timeOfDayTags: {
    flexDirection: 'row',
  },
  timeOfDayTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: 'rgba(107, 93, 255, 0.1)',
  },
  timeOfDayTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B5DFF',
  },
  takenIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  takenIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(107, 93, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#6B5DFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  takenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B5DFF',
  },
  medicationCardContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  medicationInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  medicationName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  medicationTimeAndDosage: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '600',
    marginBottom: 4,
  },
  medicationDesc: {
    fontSize: 12,
    color: '#95A5A6',
    lineHeight: 16,
  },
  pillImageContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  medicationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  lastTakenText: {
    fontSize: 12,
    color: '#95A5A6',
  },
  progressDotsContainer: {
    flexDirection: 'row',
  },
  progressDot: {
    width: 5, 
    height: 5,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: '#3498DB',
  },
  inactiveDot: {
    backgroundColor: '#E0E0E0',
  },
  paginationDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
  },
  paginationDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 2,
  },
  activePaginationDot: {
    backgroundColor: '#3498DB',
    width: 10,
    height: 3,
    borderRadius: 1.5,
  },
  editButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#3498DB',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    zIndex: 10,
  },
  pillTypeIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  pillTypeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTypeText: {
    fontSize: 14,
    color: '#2C3E50',
    marginLeft: 5,
  },
  cardPageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 15,
  },
  cardDetailsContainer: {
    flex: 1,
    marginTop: 10,
  },
  cardDetailRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  cardDetailItem: {
    flex: 1,
    marginHorizontal: 5,
  },
  cardDetailFull: {
    width: '100%',
  },
  cardDetailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 3,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  cardDetailValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
  pillHalf: {
    width: 30,
    height: 15,
    borderTopLeftRadius: 15, 
    borderTopRightRadius: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  pillCapsule: {
    width: 30,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  pillRound: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  pillSpeckles: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2980B9',
  },
  takenContainer: {
    marginLeft: 5,
  },
  takenIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(107, 93, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    marginTop: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#6B5DFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },  formModalContent: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
    paddingRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50',
  },
  formScrollView: {
    flex: 1,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
    fontWeight: '600',
  },
  formInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  timePickerOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timePickerSelected: {
    backgroundColor: '#E6F3FF',
    borderColor: '#3498DB',
  },
  timePickerText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  timePickerTextSelected: {
    color: '#3498DB',
    fontWeight: '600',
  },
  pillTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pillTypeOption: {
    width: '23%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 10,
  },
  pillTypeSelected: {
    backgroundColor: '#E6F3FF',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  pillTypeText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 5,
    textAlign: 'center',
  },
  pillTypeTextSelected: {
    color: '#3498DB',
    fontWeight: '700',
  },
  formSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 15,
    marginTop: 10,
  },
  formActions: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  saveButton: {
    height: 50,
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: '#6B5DFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  searchInput: {
    height: 50,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 15,
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  searchResultDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 3,
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchEmptyState: {
    padding: 20,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  dropdownContainer: {
    marginBottom: 20,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  dropdownModalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  dropdownList: {
    maxHeight: '85%',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemSelected: {
    backgroundColor: '#E6F3FF',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  dropdownItemTextSelected: {
    fontWeight: 'bold',
    color: '#3498DB',
  },
});

export default CalendarScreen;
