import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
  FlatList,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../components/context/AuthContext';
import { apiRequest, API_URL, MedicationService, ReminderService } from '../../services/api';
import { format, parseISO, addDays, isEqual } from 'date-fns';

const { width } = Dimensions.get('window');
const MONTH_ITEM_WIDTH = 80; // Fixed width for month items
const DAY_ITEM_WIDTH = 65;

// Helper function for updating reminder status - replaces the old ReminderService.updateStatus
const updateReminderStatus = async (id, status, token) => {
  return apiRequest(`/reminders/${id}/status`, 'PUT', { status }, token);
};

// Default mock data that will be used if API fails
const defaultMedications = [
  {
    id: '1',
    name: 'Fludac 60',
    dosage: '1 capsule',
    time: '13:30',
    frequency: 'Daily',
    pillType: 'purple-white',
    image: require('../../assets/icons/antidep.png'),
  },
  {
    id: '2',
    name: 'Tylenol',
    dosage: '1 capsule',
    time: '13:30',
    frequency: 'Daily',
    pillType: 'blue',
    image: require('../../assets/icons/medicine.png'),
  },
  {
    id: '3',
    name: 'Prozac',
    dosage: '1 capsule',
    time: '20:30',
    frequency: 'Daily',
    pillType: 'white',
    image: require('../../assets/icons/antidep.png'),
  },
  {
    id: '4',
    name: 'Aspirin',
    dosage: '1 tablet',
    time: '09:00',
    frequency: 'Daily',
    pillType: 'orange',
    image: require('../../assets/icons/medicine.png'),
  },
  {
    id: '5',
    name: 'Vitamin C',
    dosage: '1 tablet',
    time: '08:00',
    frequency: 'Daily',
    pillType: 'yellow',
    image: require('../../assets/icons/drugs.png'),
  }
];

const ReminderScreen = ({ navigation }) => {
  const { token, user } = useAuth();
  const insets = useSafeAreaInsets();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedDay, setSelectedDay] = useState(currentDate.getDate());
  
  // States for API data handling
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userMedications, setUserMedications] = useState([]);
  const [allReminders, setAllReminders] = useState([]);
  const [remindersSet, setRemindersSet] = useState([]);
  
  // States for UI and filtering
  const [medicationSchedule, setMedicationSchedule] = useState([]);
  const [activeMedicationFilter, setActiveMedicationFilter] = useState(null);
  const [sessionSwitcherVisible, setSessionSwitcherVisible] = useState(false);
  const [medicationSessions, setMedicationSessions] = useState([]);
  
  // States for medication selection and reminder creation
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [medicationSelectModalVisible, setMedicationSelectModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState('Daily');
  const [selectedTimesOfDay, setSelectedTimesOfDay] = useState(['Morning']);

  // Load user medications from API or use mock data if API fails
  const loadUserMedications = async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching medications from API...');
      const response = await MedicationService.getMedications(token);
      
      console.log('API response:', JSON.stringify(response));
      
      if (response && response.data) {
        // Check if the data is directly an array or nested in a 'medications' property
        const medications = Array.isArray(response.data) ? response.data : (response.data.medications || []);
        
        console.log(`Fetched ${medications.length} medications from API`);
        
        if (medications.length === 0) {
          console.log('No medications found, using mock data');
          setUserMedications(defaultMedications);
          return;
        }
        
        // Transform API data to match our UI model
        const transformedMeds = medications.map(med => {
          console.log(`Processing medication ${med.medication_id || med.id}: ${JSON.stringify(med)}`);
          return {
            id: (med.medication_id || med.id).toString(),
            name: med.name || 'Unnamed Medication',
            dosage: med.strength ? `${med.strength}` : (med.dosage ? `${med.dosage} ${med.dosage_unit || 'unit(s)'}` : '1 tablet'),
            time: med.default_time || '08:00',
            frequency: med.frequency || 'Daily',
            pillType: getPillTypeFromColor(med.color || '#ffffff'),
            image: getMedicationIcon(med.medication_type || med.icon || 'general'),
            description: med.description || '',
            notes: med.special_instructions || med.notes || '',
            activeIngredient: med.active_ingredient || '',
            originalData: med
          };
        });
        
        console.log(`Transformed ${transformedMeds.length} medications for UI display`);
        setUserMedications(transformedMeds);
      } else {
        console.log('No medications found or API error, using mock medication data');
        setUserMedications(defaultMedications);
      }
    } catch (err) {
      console.error('Error loading medications:', err);
      setError('Failed to load medications. Please try again.');
      setUserMedications(defaultMedications);
    } finally {
      setIsLoading(false);
    }
  };
  // Load reminders from API  
  const loadReminders = async () => {
    if (!token) return;
    
    setIsLoading(true);
    
    try {
      const response = await ReminderService.getReminders(token);
      
      if (response && response.success && response.data) {
        console.log('LOADED ALL REMINDERS FROM API');
        
        // Detailed logging of received reminders to diagnose issues
        response.data.forEach(rem => {
          console.log(`API REMINDER: ID=${rem.reminder_id || 'unknown'}, Title=${rem.title || 'untitled'}, Date=${rem.date}, Time=${rem.time}`);
        });
        
        setAllReminders(response.data);
        
        // Update medication schedule with reminders - will filter by selected date
        updateScheduleFromReminders(response.data);
        
        // Format the exact date we're showing
        const month = (selectedMonth + 1).toString().padStart(2, '0');
        const day = selectedDay.toString().padStart(2, '0');
        const year = new Date().getFullYear();
        console.log(`SHOWING REMINDERS FOR EXACT DATE: ${year}-${month}-${day}`);
      }
    } catch (err) {
      console.error('Error loading reminders:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function to convert medication colors to pill types
  const getPillTypeFromColor = (color) => {
    switch (color) {
      case '#6b5dff':
      case '#7076f0':
        return 'purple-white';
      case '#45b3fe':
      case '#3498db':
        return 'blue';
      case '#ffffff':
        return 'white';
      case '#ff954f':
      case '#f39c12':
        return 'orange';
      case '#f8d775':
      case '#f1c40f':
        return 'yellow';
      default:
        return 'white';
    }
  };
  
  // Helper function for debugging reminder API calls and responses
  const logReminderData = (payload, response = null, error = null) => {
    console.log('====== REMINDER DEBUG INFO ======');
    console.log('Reminder Payload:', JSON.stringify(payload, null, 2));
    
    if (response) {
      console.log('API Response:', JSON.stringify(response, null, 2));
    }
    
    if (error) {
      console.log('API Error:', error.message);
      if (error.response) {
        console.log('Error Status:', error.response.status);
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    console.log('Time field (critical):', payload.time);
    console.log('Selected medications:', JSON.stringify(payload.medications, null, 2));
    console.log('==============================');
  };
  
  // Helper function to get icon based on medication type
  const getMedicationIcon = (type) => {
    if (!type) return require('../../assets/icons/medicine.png');
    
    const lowercaseType = type.toLowerCase();
    
    switch (lowercaseType) {
      case 'antibiotic':
      case 'antibiotics':
        return require('../../assets/icons/antibiotics.png');
      case 'antidepressant':
      case 'antidep':
        return require('../../assets/icons/antidep.png');
      case 'antihistamine':
      case 'antihistamines':
        return require('../../assets/icons/antihistamines.png');
      case 'contraceptive':
        return require('../../assets/icons/contraceptive.png');
      case 'hypertension':
        return require('../../assets/icons/hypertension.png');
      case 'vaccine':
      case 'vaccine2':
        return require('../../assets/icons/vaccine.png');
      case 'spray':
        return require('../../assets/icons/spray.png');
      case 'pill':
      case 'drugs':
      case 'general':
        return require('../../assets/icons/drugs.png');
      default:
        return require('../../assets/icons/medicine.png');
    }
  };
  
  // Helper function to get day of week shorthand
  const getDayOfWeek = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.error('Invalid date passed to getDayOfWeek:', date);
      return '';
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };
  
  // Function to get all days in a month
  const getDaysInMonth = (month) => {
    const year = new Date().getFullYear();
    // Get the last day of the month by going to the next month and getting day 0 (which is the last day of the previous month)
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    // Create an array with all days of the month
    const days = [];
    for (let day = 1; day <= lastDay; day++) {
      days.push(day);
    }
    
    return days;
  };
  
  // Function to update reminders when date changes
  const handleDateChange = () => {
    console.log(`Date changed to ${selectedMonth+1}/${selectedDay}`);
    if (allReminders.length > 0) {
      updateScheduleFromReminders(allReminders);
    }
  };
  
  // Update reminders when selected date changes
  useEffect(() => {
    handleDateChange();
  }, [selectedMonth, selectedDay]);
    const renderMonthItem = (month, index) => (
    <TouchableOpacity 
      key={index} 
      onPress={() => {
        setSelectedMonth(index);
        // Immediately update reminders for this month if we have data
        if (allReminders.length > 0) {
          console.log(`Month selected: ${month}, immediately updating display`);
          setTimeout(() => updateScheduleFromReminders(allReminders), 50);
        }
      }}
      style={[
        styles.monthItem,
        selectedMonth === index && styles.selectedMonthItem
      ]}
    >
      <Text style={[
        styles.monthText,
        selectedMonth === index && styles.selectedMonthText
      ]}>
        {month.substring(0, 3)}
      </Text>
    </TouchableOpacity>
  );  const renderDayItem = (day) => (
    <TouchableOpacity
      key={day}
      onPress={() => {
        setSelectedDay(day);
        console.log(`Day selected: ${day}, month: ${selectedMonth + 1}`);
        
        // Hemen güncelleyin (gecikme olmadan)
        if (allReminders.length > 0) {
          updateScheduleFromReminders(allReminders);
        }
      }}
      style={[
        styles.dayItem,
        selectedDay === day && styles.selectedDayItem
      ]}
    >
      <Text style={[styles.dayNumber, selectedDay === day && styles.selectedDayNumber]}>
        {day}
      </Text>
      <Text style={[styles.dayText, selectedDay === day && styles.selectedDayText]}>
        {day === currentDate.getDate() && selectedMonth === currentDate.getMonth() ? 'Today' : getDayOfWeek(new Date(new Date().getFullYear(), selectedMonth, day))}
      </Text>
    </TouchableOpacity>
  );
  // Handle medication selection
  const handleMedicationSelect = (medication) => {
    setSelectedMedication(medication);
    setMedicationSelectModalVisible(false);
    setReminderModalVisible(true);
  };  // Handle reminder creation with enhanced options and better feedback
  const handleSetReminder = async (options = {}) => {
    if (!selectedMedication) {
      Alert.alert('Error', 'Please select a medication first.');
      return;
    }
    
    setIsLoading(true);
    Alert.alert('Processing', 'Creating your reminder, please wait...');
    
    try {
      // Get options or use defaults
      const { 
        selectedTime = '08:00',
        customStartDate,
        customEndDate = format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        withFood = false, 
        withWater = true,
        selectedDays = [1,2,3,4,5,6,7]
      } = options;
        // Format dates for API - use selected date from calendar if custom date not provided
      // CRITICAL - Format the date EXACTLY as "YYYY-MM-DD" to match database format
      const month = (selectedMonth + 1).toString().padStart(2, '0');
      const day = selectedDay.toString().padStart(2, '0');
      const year = new Date().getFullYear();
      
      // Use this formatted string directly - NO date object manipulation at all
      const startDate = customStartDate || `${year}-${month}-${day}`;
      console.log(`CREATING REMINDER FOR EXACT DATE: ${startDate} (Month: ${month}, Day: ${day})`);
      console.log(`Calendar selection: Month index=${selectedMonth}, Day=${selectedDay}`);
      
      const endDate = customEndDate;
      
      // Convert time of day to actual time if needed, or use selected time
      let reminderTime = selectedTime;
      if (!reminderTime.includes(':')) {
        const timeOfDay = {
          'Morning': '08:00',
          'Afternoon': '13:00',
          'Evening': '18:00',
          'Night': '21:00'
        };
        reminderTime = timeOfDay[reminderTime] || '08:00';
      }
      
      // Format time to include seconds for API
      const formattedTime = `${reminderTime}:00`;
      
      // Get dosage information
      const dosageString = selectedMedication.dosage || '1 tablet';
      const dosageParts = dosageString.split(' ');
      const dosageAmount = parseFloat(dosageParts[0]) || 1;
      const dosageUnit = dosageParts[1] || 'tablet';
      
      // Extract the correct medication_id from selectedMedication
      // This depends on how the medication object is structured from the API
      let medicationId = selectedMedication.id;
      if (selectedMedication.medication_id) {
        medicationId = selectedMedication.medication_id;
      } else if (selectedMedication.originalData && selectedMedication.originalData.medication_id) {
        medicationId = selectedMedication.originalData.medication_id;
      }
      
      console.log(`Creating reminder for medication ID: ${medicationId} (${selectedMedication.name}) at ${formattedTime} with frequency ${selectedFrequency}`);
      
      // Create a payload that matches what the API endpoint requires exactly
      // Based on backend route's requirements from reminder.routes.fixed.js
      const reminderPayload = {
        // Main required fields that the backend explicitly checks for
        date: startDate,
        title: `Take ${selectedMedication.name}`,
        description: `Take ${dosageAmount} ${dosageUnit} of ${selectedMedication.name}`,
        // CRITICAL: API requires a medications array with at least one item
        medications: [
          {
            medicationId: medicationId, // This must be called "medicationId", not "medication_id"
            scheduleTime: formattedTime
          }
        ],
        
        // CRITICAL: Backend requires time field in the reminders table
        time: formattedTime,
        user_id: user?.id || 1,
        repeat_type: selectedFrequency.toLowerCase(),
        repeat_days: selectedFrequency === 'Weekly' ? selectedDays.join(',') : null,
        repeat_end_date: endDate,
        status: 'pending',
        dosage: dosageAmount,
        dosage_unit: dosageUnit,
        with_food: withFood,
        with_water: withWater
      };
      
      // Use our enhanced debugging function
      logReminderData(reminderPayload);
      
      try {
        // Basic validation that matches backend requirements
        if (!reminderPayload.date || !reminderPayload.medications || reminderPayload.medications.length === 0) {
          console.error('Missing required fields:', { 
            date: reminderPayload.date,
            medications: reminderPayload.medications
          });
          Alert.alert('Error', 'Date and medication information are required to create a reminder.');
          setIsLoading(false);
          return;
        }
        
        // Time field is required in the database schema
        if (!reminderPayload.time) {
          console.error('Missing required time field');
          reminderPayload.time = formattedTime; // Use the formatted time if missing
        }
        
        // Make the API call with the complete payload
        console.log(`Making API call to create reminder with time: ${reminderPayload.time}`);
        const response = await ReminderService.createReminder(token, reminderPayload);
        
        // Log the response to help debug any issues
        logReminderData(reminderPayload, response);
        
        if (response && response.success) {
          console.log('Reminder created successfully:', response.data);
          
          // Create new reminder object for UI with all the relevant details
          const newReminder = {
            ...selectedMedication,
            id: response.data.id,
            reminder_id: response.data.id,
            reminderMedId: response.data.medications?.[0]?.id || response.data.id, // Add for HomeScreen compatibility
            frequency: selectedFrequency,
            timesOfDay: selectedTimesOfDay,
            time: reminderTime,
            dateAdded: new Date(),
            status: 'pending',
            withFood,
            withWater
          };
          
          // Add the reminder to the local state
          setRemindersSet([...remindersSet, newReminder]);
          
          // Update the medication schedule to include the new reminder
          updateMedicationSchedule(newReminder);
          
          // Show detailed success message
          Alert.alert(
            'Reminder Created Successfully', 
            `Your reminder for ${selectedMedication.name} has been set for ${reminderTime} ${selectedFrequency === 'Weekly' ? 'on selected days' : selectedFrequency.toLowerCase()}.\n\nIt will appear on your home screen.`,
            [
              { text: 'OK', onPress: () => {
                // Close modal and reset fields
                setReminderModalVisible(false);
                setSelectedMedication(null);
                setSelectedFrequency('Daily');
                setSelectedTimesOfDay(['Morning']);
                
                // Reload reminders to ensure the latest data is displayed
                loadReminders();
              }}
            ]
          );
        } else {
          throw new Error('Failed to create reminder');
        }
      } catch (apiError) {
        console.error('API Error creating reminder:', apiError);
        
        // Log the error for debugging
        logReminderData(reminderPayload, null, apiError);
        
        // Show more specific error message to the user based on the error
        let errorMessage = 'Failed to create reminder';
        
        if (apiError.message && apiError.message.includes('Date and medications are required')) {
          errorMessage = 'Please ensure medication and date information is correct';
          console.log('API validation error - missing required fields');
        } else if (apiError.message && apiError.message.includes("Field 'time' doesn't have a default value")) {
          errorMessage = 'Time information is missing or invalid';
          console.log('API validation error - missing time field');
        } else if (apiError.message && apiError.message.includes('Network')) {
          errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        } else if (apiError.message && apiError.message.includes('timed out')) {
          errorMessage = 'Server is taking too long to respond. Please try again later.';
        }
        
        Alert.alert(
          'Error Creating Reminder', 
          errorMessage,
          [
            { 
              text: 'Try Again', 
              onPress: () => {
                // Let the user try again without closing the modal
              }
            },
            {
              text: 'Use Demo Mode',
              onPress: () => {
                // Create a mock response for demo purposes
                console.log('Using mock data since API failed');
                const mockReminderId = `mock-${Math.floor(Math.random() * 1000)}`;
                
                // Create new reminder object for UI
                const newReminder = {
                  ...selectedMedication,
                  id: mockReminderId,
                  reminder_id: mockReminderId,
                  reminderMedId: mockReminderId, // Add for HomeScreen compatibility
                  frequency: selectedFrequency,
                  timesOfDay: selectedTimesOfDay,
                  time: reminderTime,
                  dateAdded: new Date(),
                  status: 'pending',
                  withFood: options.withFood || false,
                  withWater: options.withWater || true
                };
                
                // Add the reminder to the list
                setRemindersSet([...remindersSet, newReminder]);
                
                // Update the medication schedule to include the new reminder
                updateMedicationSchedule(newReminder);
                
                // Show success message
                Alert.alert(
                  'Reminder Created (Demo Mode)', 
                  `Your reminder for ${selectedMedication.name} has been set in demo mode. It will appear on your home screen temporarily.`,
                  [
                    { text: 'OK', onPress: () => {
                      // Close modal and reset fields
                      setReminderModalVisible(false);
                      setSelectedMedication(null);
                      setSelectedFrequency('Daily');
                      setSelectedTimesOfDay(['Morning']);
                      
                      // Reload reminders
                      loadReminders();
                    }}
                  ]
                );
              }
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                // Allow user to cancel and stay on the reminder modal
              }
            }
          ]
        );
        
        // Keep the loading indicator off
        setIsLoading(false);
        return; // Exit the function early
      }
    } catch (err) {
      console.error('Error creating reminder:', err);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the medication schedule with the new reminder
  const updateMedicationSchedule = (reminder) => {
    // For this mock implementation, we'll just add it to the existing schedule
    // In a real app, you would need to handle time conflicts, sorting, etc.
    
    // Clone current schedule
    const updatedSchedule = [...medicationSchedule];
    
    // Find if there's already a time slot for this medication's time
    const timeSlotIndex = updatedSchedule.findIndex(slot => slot.time === reminder.time);
    
    if (timeSlotIndex >= 0) {
      // Add to existing time slot
      updatedSchedule[timeSlotIndex].medications.push({
        id: reminder.id,
        name: reminder.name,
        dosage: reminder.dosage,
        color: getPillColor(reminder.pillType),
        status: 'pending',
        image: reminder.image
      });
    } else {
      // Create new time slot
      updatedSchedule.push({
        time: reminder.time,
        medications: [{
          id: reminder.id,
          name: reminder.name,
          dosage: reminder.dosage,
          color: getPillColor(reminder.pillType),
          status: 'pending',
          image: reminder.image
        }]
      });
      
      // Sort slots by time
      updatedSchedule.sort((a, b) => {
        const timeA = convertTimeToMinutes(a.time);
        const timeB = convertTimeToMinutes(b.time);
        return timeA - timeB;
      });
    }
    
    // Update medication sessions (create if not exists)
    const existingSessionIndex = medicationSessions.findIndex(
      session => session.medicationId === reminder.id
    );
    
    if (existingSessionIndex >= 0) {
      // Update existing session
      const updatedSessions = [...medicationSessions];
      updatedSessions[existingSessionIndex].lastUpdated = new Date();
      setMedicationSessions(updatedSessions);
    } else {
      // Create new session for this medication
      const newSession = {
        medicationId: reminder.id,
        name: reminder.name,
        image: reminder.image,
        color: getPillColor(reminder.pillType),
        lastUpdated: new Date(),
      };
      setMedicationSessions([...medicationSessions, newSession]);
    }
    
    setMedicationSchedule(updatedSchedule);
  };
    // Update medication schedule based on reminders from API
  const updateScheduleFromReminders = (reminders) => {
    try {
      // Tam olarak seçilen tarihi YYYY-MM-DD formatında hazırlayalım
      const month = (selectedMonth + 1).toString().padStart(2, '0');
      const day = selectedDay.toString().padStart(2, '0');
      const year = new Date().getFullYear();
      const selectedDateStr = `${year}-${month}-${day}`;
      console.log(`ARANAN TARİH: ${selectedDateStr} (Ay: ${month}, Gün: ${day})`);
      
      // Tüm hatırlatmaları logla - hata ayıklama için
      console.log(`TÜM HATIRLAYICILAR (${reminders.length}):`);
      reminders.forEach(r => {
        console.log(`ID: ${r.reminder_id}, Başlık: ${r.title}, Tarih: ${r.date}, Saat: ${r.time}`);
      });
      
      // Seçilen tarih için hatırlatıcıları filtrele
      // Doğrudan string karşılaştırması kullan, tarih manipülasyonu yapmadan
      const activeReminders = reminders.filter(rem => {
        if (!rem.date) return false;
        
        // Bu bölüm kritik - seçilen tarih ile veritabanı değeri arasında tam eşleşme kontrol ediliyor
        const exactMatch = rem.date === selectedDateStr;
        
        console.log(`HATIRLATICI: "${rem.title}" - tarih: ${rem.date} - Seçilen tarih ${selectedDateStr} ile eşleşiyor mu: ${exactMatch}`);
        
        return exactMatch;
      });
      
      // Count how many reminders matched this date
      console.log(`FOUND ${activeReminders.length} REMINDERS FOR ${selectedDateStr}`);
      
      // Group reminders by time - MAKE SURE TIME IS EXTRACTED CORRECTLY
      const timeGroups = {};
      
      activeReminders.forEach(rem => {
        // Extract HH:MM from time (handle variations in format)
        const timeString = rem.time || '00:00:00';
        const time = timeString.substring(0, 5); // Format HH:MM
        console.log(`REMINDER: "${rem.title}" - Using time: ${time} from original: ${timeString}`);
        
        if (!timeGroups[time]) {
          timeGroups[time] = [];
        }
        
        // Get medication details if linked to a medication
        if (rem.medication_id) {
          const linkedMedication = userMedications.find(med => 
            med.id === rem.medication_id.toString());
          
          if (linkedMedication) {
            timeGroups[time].push({
              id: rem.medication_id.toString(),
              name: linkedMedication.name, 
              dosage: `${rem.dosage || 1} ${linkedMedication.dosage.split(' ')[1] || 'tablet'}`,
              color: getPillColorFromType(linkedMedication.pillType),
              status: rem.reminder_medications?.[0]?.status || 'pending',
              image: linkedMedication.image,
              reminder_id: rem.reminder_id
            });
          }
        } else {
          // For non-medication reminders (general health reminders)
          timeGroups[time].push({
            id: `reminder-${rem.reminder_id}`,
            name: rem.title,
            dosage: rem.description,
            color: '#3cc5b7', // Default color for general reminders
            status: rem.status,
            image: require('../../assets/icons/medicine.png'),
            reminder_id: rem.reminder_id
          });
        }
      });
      
      // Convert to schedule format
      const newSchedule = Object.keys(timeGroups).sort().map(time => ({
        time,
        medications: timeGroups[time]
      }));
      
      setMedicationSchedule(newSchedule);
      
      // Update medication sessions based on reminders
      updateMedicationSessions(reminders);
    } catch (err) {
      console.error('Error updating schedule from reminders:', err);
    }
  };
  
  // Convert time string (HH:MM) to minutes for sorting
  const convertTimeToMinutes = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return 0;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return (hours * 60) + minutes;
  };

  // Get pill color from pill type - this was missing and causing the error
  const getPillColor = (pillType) => {
    switch (pillType) {
      case 'purple-white':
        return '#6b5dff';
      case 'blue':
        return '#45b3fe';
      case 'white':
        return '#ffffff';
      case 'orange':
        return '#ff954f';
      case 'yellow':
        return '#f8d775';
      default:
        return '#e0e0e0';
    }
  };
  
  // Get pill color from pill type
  const getPillColorFromType = (pillType) => {
    switch (pillType) {
      case 'purple-white':
        return '#6b5dff';
      case 'blue':
        return '#45b3fe';
      case 'white':
        return '#ffffff';
      case 'orange':
        return '#ff954f';
      case 'yellow':
        return '#f8d775';
      default:
        return '#e0e0e0';
    }
  };
  
  // Update medication sessions from reminders
  const updateMedicationSessions = (reminders) => {
    // Group reminders by medication
    const medicationGroups = {};
    
    reminders.forEach(rem => {
      if (rem.medication_id) {
        if (!medicationGroups[rem.medication_id]) {
          medicationGroups[rem.medication_id] = [];
        }
        medicationGroups[rem.medication_id].push(rem);
      }
    });
    
    // Create session objects
    const sessions = Object.keys(medicationGroups).map(medId => {
      const medication = userMedications.find(med => med.id === medId.toString());
      
      if (!medication) return null;
      
      return {
        medicationId: medId,
        name: medication.name,
        image: medication.image,
        color: getPillColorFromType(medication.pillType),
        lastUpdated: new Date(),
      };
    }).filter(Boolean);
    
    setMedicationSessions(sessions);
  };
  // Handle marking medication as taken or not taken
  const handleMedicationStatus = async (scheduleIndex, medicationIndex) => {
    try {
      const medication = medicationSchedule[scheduleIndex].medications[medicationIndex];
      const currentStatus = medication.status;
      const newStatus = currentStatus === 'taken' ? 'pending' : 'taken';
      
      // Update local state immediately for better UX
      const updatedSchedule = [...medicationSchedule];
      updatedSchedule[scheduleIndex].medications[medicationIndex].status = newStatus;
      setMedicationSchedule(updatedSchedule);
      
      // Skip API update if no reminder_id (mock data)
      if (!medication.reminder_id) {
        console.log('No reminder_id found, skipping API update');
        return;
      }
      
      // If this is a medication reminder with a reminder_id, update it in the database
      if (medication.reminder_id) {
        console.log(`Updating reminder ${medication.reminder_id} status to ${newStatus}`);
        
        // Call API to update status
        const response = await updateReminderStatus(
          medication.reminder_id,
          newStatus,
          token
        );
        
        if (response && response.success) {
          console.log('Reminder status updated successfully');
          
          // Create medication history entry for tracking
          if (newStatus === 'taken') {
            const historyData = {
              medication_id: medication.id,
              dosage_taken: parseFloat(medication.dosage.split(' ')[0]) || 1,
              taken_date: format(new Date(), 'yyyy-MM-dd'),
              taken_time: format(new Date(), 'HH:mm:ss'),
              status: 'taken',
              reminder_id: medication.reminder_id
            };
            
            // Call API to create history entry
            apiRequest('/medication-history', 'POST', historyData, token)
              .then(res => console.log('History entry created:', res))
              .catch(err => console.error('Error creating history entry:', err));
          }
        } else {
          throw new Error('Failed to update reminder status');
        }
      }
    } catch (err) {
      console.error('Error updating medication status:', err);
      
      // Revert local state on error
      const updatedSchedule = [...medicationSchedule];
      updatedSchedule[scheduleIndex].medications[medicationIndex].status = 
        updatedSchedule[scheduleIndex].medications[medicationIndex].status === 'taken' ? 'pending' : 'taken';
      setMedicationSchedule(updatedSchedule);
      
      Alert.alert('Error', 'Failed to update medication status. Please try again.');
    }
  };

  const renderMedicationItem = (medication, scheduleIndex, medicationIndex) => (
    <View key={medicationIndex} style={styles.medicationItem}>
      <View style={[
        styles.medicationColorBar, 
        { 
          backgroundColor: medication.color,
          borderWidth: medication.borderColor ? 1 : 0,
          borderColor: medication.borderColor || 'transparent'
        }
      ]} />
      
      <View style={styles.medicationIconContainer}>
        <Image source={medication.image} style={styles.medicationIcon} />
      </View>
      
      <View style={styles.medicationDetails}>
        <Text style={styles.medicationName}>{medication.name}</Text>
        <Text style={styles.medicationDosage}>{medication.dosage}</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.medicationStatusButton}
        onPress={() => handleMedicationStatus(scheduleIndex, medicationIndex)}
      >
        {medication.status === 'taken' ? (
          <Ionicons name="checkmark-circle" size={24} color="#4cd964" />
        ) : (
          <Ionicons name="radio-button-off" size={24} color="#999" />
        )}
      </TouchableOpacity>
    </View>
  );
  // Render medication selection modal  // Render the medication selection modal
  const renderMedicationSelectModal = () => (
    <Modal
      visible={medicationSelectModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setMedicationSelectModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Medication for Reminder</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setMedicationSelectModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Loading state */}
          {isLoading ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#3cc5b7" />
              <Text style={styles.loadingText}>Loading your medications...</Text>
            </View>
          ) : userMedications && userMedications.length > 0 ? (
            <>
              <Text style={styles.modalSubtitle}>
                Choose a medication to create a reminder for:
              </Text>
              
              {/* Medication list with improved styling and interaction */}
              <FlatList
                data={userMedications}
                keyExtractor={item => item.id || item.medication_id?.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.medicationSelectItem}
                    onPress={() => handleMedicationSelect(item)}
                    activeOpacity={0.7}
                  >
                    {/* Medication icon */}
                    <View style={[
                      styles.medicationSelectIconContainer,
                      { backgroundColor: getPillColorFromType(item.pillType) + '20' } // Add slight tint based on pill color
                    ]}>
                      <Image source={item.image} style={styles.medicationSelectIcon} />
                    </View>
                    
                    {/* Medication details */}
                    <View style={styles.medicationSelectDetails}>
                      <Text style={styles.medicationSelectName}>{item.name}</Text>
                      <Text style={styles.medicationSelectDosage}>
                        {item.dosage || '1 tablet'} · {item.frequency || 'Daily'}
                      </Text>
                      {item.strength && (
                        <Text style={styles.medicationSelectStrength}>{item.strength}</Text>
                      )}
                    </View>
                    
                    {/* Selection indicator */}
                    <View style={styles.medicationSelectAction}>
                      <Text style={styles.medicationSelectActionText}>Set Reminder</Text>
                      <Ionicons name="chevron-forward" size={22} color="#3cc5b7" />
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.medicationSelectList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.centeredContainer}>
                    <Ionicons name="medical-outline" size={60} color="#ccc" />
                    <Text style={styles.emptyText}>No medications found</Text>
                  </View>
                }
              />
            </>
          ) : (
            <View style={styles.centeredContainer}>
              <Ionicons name="medical-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No medications found</Text>
              <Text style={styles.emptySubtext}>You need to add medications before creating reminders</Text>
              <TouchableOpacity 
                style={styles.addMedicationButton}
                onPress={() => {
                  setMedicationSelectModalVisible(false);
                  // Navigate to Add Medication screen
                  navigation.navigate('AddMedication');
                }}
              >
                <Text style={styles.addMedicationButtonText}>Add Medication</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
    // Render reminder settings modal with enhanced options
  const renderReminderModal = () => {
    // Get the current time in HH:MM format
    const currentTime = format(new Date(), 'HH:mm');
    
    // State for custom time picker
    const [selectedTime, setSelectedTime] = useState(selectedMedication?.time || currentTime);
    const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    const [withFood, setWithFood] = useState(false);
    const [withWater, setWithWater] = useState(true);
    const [selectedDays, setSelectedDays] = useState([1,2,3,4,5,6,7]); // All days selected by default
    
    // Standard time options for quick selection
    const timeOptions = ['08:00', '12:00', '18:00', '21:00'];
    
    // Day options for weekly selection
    const dayOptions = [
      { value: 1, label: 'M' },
      { value: 2, label: 'T' },
      { value: 3, label: 'W' },
      { value: 4, label: 'T' },
      { value: 5, label: 'F' },
      { value: 6, label: 'S' },
      { value: 7, label: 'S' }
    ];
    
    // Toggle day selection
    const toggleDay = (dayValue) => {
      if (selectedDays.includes(dayValue)) {
        setSelectedDays(selectedDays.filter(day => day !== dayValue));
      } else {
        setSelectedDays([...selectedDays, dayValue]);
      }
    };
    
    return (
      <Modal
        visible={reminderModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <TouchableOpacity onPress={() => setReminderModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedMedication && (
              <ScrollView style={styles.reminderContent}>
                {/* Medication Info */}
                <View style={styles.selectedMedicationInfo}>
                  <View style={styles.selectedMedicationIconContainer}>
                    <Image source={selectedMedication.image} style={styles.selectedMedicationIcon} />
                  </View>
                  <View>
                    <Text style={styles.selectedMedicationName}>{selectedMedication.name}</Text>
                    <Text style={styles.selectedMedicationDosage}>{selectedMedication.dosage}</Text>
                  </View>
                </View>
                
                {/* Frequency Section */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Frequency</Text>
                  <View style={styles.frequencyOptions}>
                    {['Daily', 'Weekly', 'Monthly', 'As needed'].map((freq) => (
                      <TouchableOpacity 
                        key={freq}
                        style={[
                          styles.frequencyOption,
                          selectedFrequency === freq && styles.selectedFrequencyOption
                        ]}
                        onPress={() => setSelectedFrequency(freq)}
                      >
                        <Text style={[
                          styles.frequencyOptionText,
                          selectedFrequency === freq && styles.selectedFrequencyOptionText
                        ]}>
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                  {/* Days of week (only show if Weekly is selected) - Improved UI */}
                {selectedFrequency === 'Weekly' && (
                  <View style={styles.reminderSettingSection}>
                    <Text style={styles.reminderSettingTitle}>Days of Week</Text>
                    <View style={styles.weekdayHelperText}>
                      <Text style={styles.helperText}>Select the days of the week for this reminder</Text>
                    </View>                    <View style={styles.daysContainer}>
                      {dayOptions.map(day => (
                        <TouchableOpacity
                          key={day.value}
                          style={[
                            styles.dayOption,
                            selectedDays.includes(day.value) && styles.selectedDayOption
                          ]}
                          onPress={() => toggleDay(day.value)}
                        >
                          <Text style={[
                            styles.dayOptionText,
                            selectedDays.includes(day.value) && styles.selectedDayOptionText
                          ]}>
                            {day.label}
                          </Text>
                          {selectedDays.includes(day.value) && (
                            <View style={styles.selectedDayIndicator}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.daySelectionHelpers}>
                      <TouchableOpacity 
                        style={styles.daySelectionHelper}
                        onPress={() => setSelectedDays([1,2,3,4,5,6,7])}
                      >
                        <Text style={styles.daySelectionHelperText}>All days</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.daySelectionHelper}
                        onPress={() => setSelectedDays([1,2,3,4,5])}
                      >
                        <Text style={styles.daySelectionHelperText}>Weekdays</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.daySelectionHelper}
                        onPress={() => setSelectedDays([6,7])}
                      >
                        <Text style={styles.daySelectionHelperText}>Weekend</Text>
                      </TouchableOpacity>
                    </View>
                  </View>                )}
                  {/* Time Options - Improved UI */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Reminder Time</Text>
                  <View style={styles.timeOptionsContainer}>
                    <View style={styles.timeOptions}>
                      {timeOptions.map((time) => (
                        <TouchableOpacity 
                          key={time}
                          style={[
                            styles.timeOption,
                            selectedTime === time && styles.selectedTimeOption
                          ]}
                          onPress={() => setSelectedTime(time)}
                        >
                          <Ionicons 
                            name={selectedTime === time ? "time" : "time-outline"} 
                            size={18} 
                            color={selectedTime === time ? "#fff" : "#555"} 
                            style={styles.timeIcon} 
                          />
                          <Text style={[
                            styles.timeOptionText,
                            selectedTime === time && styles.selectedTimeOptionText
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {/* Custom time option with better UI */}                    <View style={styles.customTimeContainer}>
                      <Text style={styles.customTimeLabel}>Custom time:</Text>
                      <View style={styles.customTimeInputRow}>
                        <TouchableOpacity 
                          style={[
                            styles.customTimeButton, 
                            !timeOptions.includes(selectedTime) && styles.selectedTimeOption
                          ]}
                          onPress={() => {
                            // Show more custom time options in a dropdown-like UI
                            Alert.alert(
                              "Select Custom Time",
                              "Choose a time for your medication reminder",
                              [
                                { text: "09:30", onPress: () => setSelectedTime("09:30") },
                                { text: "14:30", onPress: () => setSelectedTime("14:30") },
                                { text: "17:00", onPress: () => setSelectedTime("17:00") },
                                { text: "22:00", onPress: () => setSelectedTime("22:00") },
                                { text: "Cancel", style: "cancel" }
                              ]
                            );
                          }}
                        >
                          <View style={styles.customTimeButtonContent}>
                            <Ionicons name="time" size={20} color={!timeOptions.includes(selectedTime) ? "#fff" : "#555"} />
                            <Text style={[
                              styles.customTimeText,
                              !timeOptions.includes(selectedTime) && styles.selectedTimeOptionText
                            ]}>
                              {!timeOptions.includes(selectedTime) ? selectedTime : 'Select custom time'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={!timeOptions.includes(selectedTime) ? "#fff" : "#555"} />
                          </View>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Custom time selection hint */}
                      <Text style={styles.customTimeHint}>
                        Tap to select a specific time for your reminder
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Custom date selection - New section */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Reminder Date</Text>
                  <View style={styles.dateSelectionContainer}>
                    <TouchableOpacity 
                      style={styles.datePickerButton}
                      onPress={() => {
                        // Show date picker modal or use a custom calendar UI
                        const selectedYear = selectedMonth < currentDate.getMonth() ? 
                          currentDate.getFullYear() + 1 : currentDate.getFullYear();
                        
                        const newDate = new Date(selectedYear, selectedMonth, selectedDay);
                        const formattedDate = format(newDate, 'yyyy-MM-dd');
                        setCustomStartDate(formattedDate);
                        
                        Alert.alert(
                          "Date Selected", 
                          `Your reminder is set for ${format(newDate, 'MMMM d, yyyy')}`,
                          [{ text: "OK" }]
                        );
                      }}
                    >
                      <View style={styles.dateButtonRow}>
                        <Ionicons name="calendar" size={20} color="#555" />
                        <Text style={styles.dateButtonText}>
                          {format(parseISO(customStartDate), 'MMMM d, yyyy')}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#555" />
                      </View>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Calendar view for date selection */}
                  <View style={styles.miniCalendarContainer}>
                    <Text style={styles.miniCalendarTitle}>Quick Date Selection:</Text>
                    
                    {/* Month selection */}
                    <ScrollView 
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.monthsScrollView}
                      contentContainerStyle={styles.monthsContainer}
                    >
                      {months.map((month, index) => (
                        <TouchableOpacity 
                          key={index} 
                          onPress={() => {
                            setSelectedMonth(index);
                            // Update the custom start date
                            const selectedYear = index < currentDate.getMonth() ? 
                              currentDate.getFullYear() + 1 : currentDate.getFullYear();
                            const newDate = new Date(selectedYear, index, selectedDay);
                            setCustomStartDate(format(newDate, 'yyyy-MM-dd'));
                          }}
                          style={[
                            styles.miniMonthItem,
                            selectedMonth === index && styles.selectedMiniMonthItem
                          ]}
                        >
                          <Text style={[
                            styles.miniMonthText,
                            selectedMonth === index && styles.selectedMiniMonthText
                          ]}>
                            {month.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    
                    {/* Days selection */}
                    <ScrollView 
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.daysScrollView}
                      contentContainerStyle={styles.daysContainer}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <TouchableOpacity
                          key={day}
                          onPress={() => {
                            setSelectedDay(day);
                            // Update the custom start date
                            const selectedYear = selectedMonth < currentDate.getMonth() ? 
                              currentDate.getFullYear() + 1 : currentDate.getFullYear();
                            const newDate = new Date(selectedYear, selectedMonth, day);
                            setCustomStartDate(format(newDate, 'yyyy-MM-dd'));
                          }}
                          style={[
                            styles.miniDayItem,
                            selectedDay === day && styles.selectedMiniDayItem
                          ]}
                        >
                          <Text style={[
                            styles.miniDayNumber, 
                            selectedDay === day && styles.selectedMiniDayNumber
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                
                {/* Times of Day */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Time of Day</Text>
                  <View style={styles.timesOfDayOptions}>
                    {['Morning', 'Afternoon', 'Evening', 'Night'].map((time) => (
                      <TouchableOpacity 
                        key={time}
                        style={[
                          styles.timeOfDayOption,
                          selectedTimesOfDay.includes(time) && styles.selectedTimeOfDayOption
                        ]}
                        onPress={() => {
                          if (selectedTimesOfDay.includes(time)) {
                            setSelectedTimesOfDay(selectedTimesOfDay.filter(t => t !== time));
                          } else {
                            setSelectedTimesOfDay([...selectedTimesOfDay, time]);
                          }
                        }}
                      >
                        <Text style={[
                          styles.timeOfDayOptionText,
                          selectedTimesOfDay.includes(time) && styles.selectedTimeOfDayOptionText
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* Additional Options */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Additional Options</Text>
                  <View style={styles.additionalOptions}>
                    <TouchableOpacity 
                      style={styles.optionRow}
                      onPress={() => setWithFood(!withFood)}
                    >
                      <View style={styles.optionTextContainer}>
                        <Ionicons name="restaurant-outline" size={18} color="#555" />
                        <Text style={styles.optionText}>Take with food</Text>
                      </View>
                      <View style={[
                        styles.checkBox, 
                        withFood && styles.checkBoxSelected
                      ]}>
                        {withFood && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.optionRow}
                      onPress={() => setWithWater(!withWater)}
                    >
                      <View style={styles.optionTextContainer}>
                        <Ionicons name="water-outline" size={18} color="#555" />
                        <Text style={styles.optionText}>Take with water</Text>
                      </View>
                      <View style={[
                        styles.checkBox, 
                        withWater && styles.checkBoxSelected
                      ]}>
                        {withWater && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
                  {/* Summary Section */}
                <View style={styles.reminderSettingSection}>
                  <Text style={styles.reminderSettingTitle}>Summary</Text>
                  <View style={styles.reminderSummary}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Medication:</Text>
                      <Text style={styles.summaryValue}>{selectedMedication.name}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Dosage:</Text>
                      <Text style={styles.summaryValue}>{selectedMedication.dosage}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Time:</Text>
                      <Text style={styles.summaryValue}>{selectedTime}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Frequency:</Text>
                      <Text style={styles.summaryValue}>{selectedFrequency}</Text>
                    </View>
                    {selectedFrequency === 'Weekly' && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Days:</Text>
                        <Text style={styles.summaryValue}>
                          {selectedDays.map(d => dayOptions.find(day => day.value === d)?.label).join(', ')}
                        </Text>
                      </View>
                    )}
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>With food:</Text>
                      <Text style={styles.summaryValue}>{withFood ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>With water:</Text>
                      <Text style={styles.summaryValue}>{withWater ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </View>
                
                {/* Set Reminder Button - Enhanced */}
                <TouchableOpacity 
                  style={styles.setReminderButton}
                  onPress={() => {
                    // Validate selection
                    if (!selectedTime) {
                      Alert.alert('Error', 'Please select a valid time for your reminder.');
                      return;
                    }
                    
                    if (selectedFrequency === 'Weekly' && selectedDays.length === 0) {
                      Alert.alert('Error', 'Please select at least one day of the week.');
                      return;
                    }
                    
                    // Pass the additional settings to the handleSetReminder function
                    handleSetReminder({
                      selectedTime,
                      customStartDate,
                      customEndDate,
                      withFood,
                      withWater,
                      selectedDays: selectedFrequency === 'Weekly' ? selectedDays : [1,2,3,4,5,6,7]
                    });
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={styles.buttonContentRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.setReminderButtonText, {marginLeft: 10}]}>Creating...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContentRow}>
                      <Ionicons name="alarm" size={20} color="#fff" />
                      <Text style={styles.setReminderButtonText}>Save Reminder</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Cancel Button */}
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setReminderModalVisible(false)}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                {/* Disclaimer */}
                <Text style={styles.reminderDisclaimer}>
                  This reminder will sync with your home screen and calendar
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // Render session switcher modal
  const renderSessionSwitcherModal = () => (
    <Modal
      visible={sessionSwitcherVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setSessionSwitcherVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Medication Sessions</Text>
            <TouchableOpacity onPress={() => setSessionSwitcherVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {medicationSessions.length > 0 ? (
            <FlatList
              data={medicationSessions}
              keyExtractor={item => item.medicationId}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.medicationSelectItem,
                    activeMedicationFilter === item.medicationId && styles.activeSessionItem
                  ]}
                  onPress={() => switchToMedicationSession(item.medicationId)}
                >
                  <View style={[
                    styles.medicationSelectIconContainer, 
                    { backgroundColor: item.color ? `${item.color}20` : '#f5f7fa' }
                  ]}>
                    <Image source={item.image} style={styles.medicationSelectIcon} />
                  </View>
                  <View style={styles.medicationSelectDetails}>
                    <Text style={styles.medicationSelectName}>{item.name}</Text>
                    <Text style={styles.medicationSelectDosage}>
                      {activeMedicationFilter === item.medicationId ? 'Current Session' : 'Tap to view'}
                    </Text>
                  </View>
                  {activeMedicationFilter === item.medicationId && (
                    <Ionicons name="checkmark-circle" size={24} color="#3cc5b7" />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.medicationSelectList}
              ListHeaderComponent={
                <TouchableOpacity 
                  style={[
                    styles.medicationSelectItem, 
                    !activeMedicationFilter && styles.activeSessionItem
                  ]}
                  onPress={clearMedicationFilter}
                >
                  <View style={styles.medicationSelectIconContainer}>
                    <Ionicons name="calendar" size={24} color="#666" />
                  </View>
                  <View style={styles.medicationSelectDetails}>
                    <Text style={styles.medicationSelectName}>All Medications</Text>
                    <Text style={styles.medicationSelectDosage}>
                      {!activeMedicationFilter ? 'Current View' : 'Tap to view all'}
                    </Text>
                  </View>
                  {!activeMedicationFilter && (
                    <Ionicons name="checkmark-circle" size={24} color="#3cc5b7" />
                  )}
                </TouchableOpacity>
              }
            />
          ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="calendar-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No medication sessions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add medications to your schedule to create sessions
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // Get filtered schedule based on active medication filter
  const getFilteredSchedule = () => {
    if (!activeMedicationFilter) {
      return medicationSchedule; // Return the full schedule if no filter
    }
    
    // Create a filtered schedule with only the selected medication
    const filteredSchedule = medicationSchedule
      .map(timeSlot => ({
        time: timeSlot.time,
        medications: timeSlot.medications.filter(med => med.id === activeMedicationFilter)
      }))
      .filter(timeSlot => timeSlot.medications.length > 0); // Remove empty time slots
    
    return filteredSchedule;
  };
  
  // Handle switching to a medication session
  const switchToMedicationSession = (medicationId) => {
    setActiveMedicationFilter(medicationId);
    setSessionSwitcherVisible(false);
  };
  
  // Clear medication filter
  const clearMedicationFilter = () => {
    setActiveMedicationFilter(null);
  };

  // UseEffect hooks for data loading and refreshing
  useEffect(() => {
    // Initial data load when component mounts
    if (token) {
      console.log('ReminderScreen mounted, loading initial data...');
      loadUserMedications();
      loadReminders();
    }
  }, [token]);
  
  // Add navigation focus listener to refresh data when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh data when screen comes into focus
      console.log('ReminderScreen focused, refreshing data...');
      if (token) {
        loadUserMedications();
        loadReminders();
      }
    });
    
    // Clean up the listener when component unmounts
    return unsubscribe;
  }, [navigation, token]);
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3cc5b7" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Reminder</Text>
            <Text style={styles.headerSubtitle}>
              {months[selectedMonth]} {selectedDay}, 2025
            </Text>
          </View>
          <View style={styles.headerButtons}>
            {activeMedicationFilter && (
              <TouchableOpacity 
                style={styles.sessionButton}
                onPress={() => setSessionSwitcherVisible(true)}
              >
                <View style={styles.activeMedicationIndicator}>
                  {medicationSessions.find(session => session.medicationId === activeMedicationFilter)?.image && (
                    <Image 
                      source={medicationSessions.find(session => session.medicationId === activeMedicationFilter).image}
                      style={styles.activeMedicationIcon} 
                    />
                  )}
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.addReminderButton}
              onPress={() => setMedicationSelectModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
          {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {/* Session indicator (when filter is active) */}
        {activeMedicationFilter && (
          <View style={styles.sessionIndicator}>
            <Text style={styles.sessionText}>
              Viewing schedule for:{' '}
              <Text style={styles.sessionMedicationName}>
                {medicationSessions.find(session => session.medicationId === activeMedicationFilter)?.name}
              </Text>
            </Text>
            <TouchableOpacity 
              style={styles.clearFilterButton}
              onPress={clearMedicationFilter}
            >
              <Text style={styles.clearFilterText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Month selector */}
        <View style={styles.monthSelectorContainer}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthsContainer}
          >
            {months.map((month, index) => renderMonthItem(month, index))}
          </ScrollView>
        </View>        {/* Days selector */}
        <View style={styles.daySelectorContainer}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysContainer}
            initialScrollOffset={0} // Başlangıçta en başa kaydır
          >
            {getDaysInMonth(selectedMonth).map(day => renderDayItem(day))}
          </ScrollView>
        </View>

        {/* Schedule content */}
        <View style={styles.scheduleContainer}>
          <View style={styles.scheduleHeader}>
            <Text style={styles.scheduleHeaderTitle}>
              {activeMedicationFilter ? 'Medication Schedule' : 'Schedule'}
            </Text>
            <TouchableOpacity onPress={() => setSessionSwitcherVisible(true)}>
              <Text style={styles.scheduleHeaderAction}>
                {activeMedicationFilter ? 'Switch' : 'Filter'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {getFilteredSchedule().length > 0 ? (
            <ScrollView 
              style={styles.scheduleList}
              showsVerticalScrollIndicator={false}
            >
              {getFilteredSchedule().map((schedule, scheduleIndex) => (
                <View key={scheduleIndex} style={styles.scheduleItem}>
                  <Text style={styles.scheduleTime}>{schedule.time}</Text>
                  <View style={styles.medicationList}>
                    {schedule.medications.map((med, medIndex) => 
                      renderMedicationItem(med, scheduleIndex, medIndex)
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyScheduleContainer}>
              <Ionicons name="calendar-outline" size={60} color="#ccc" />
              <Text style={styles.emptyStateText}>No medications scheduled</Text>
              <Text style={styles.emptyStateSubtext}>
                {activeMedicationFilter ? 
                  'This medication has no scheduled reminders' : 
                  'Add medications to start your schedule'}
              </Text>
              <TouchableOpacity 
                style={styles.addMedicationButton}
                onPress={() => setMedicationSelectModalVisible(true)}
              >
                <Text style={styles.addMedicationButtonText}>Add Medication</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
          {/* Add floating action button - enhanced UI */}
        <TouchableOpacity 
          style={styles.floatingButton}
          onPress={() => {
            if (userMedications.length === 0) {
              // If the user doesn't have medications, show an alert
              Alert.alert(
                'No Medications Found',
                'You need to add medications before creating reminders. Would you like to add a medication now?',
                [
                  {
                    text: 'Yes, Add Medication',
                    onPress: () => navigation.navigate('AddMedication')
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  }
                ]
              );
            } else {
              // If medications exist, show the medication selection modal
              setMedicationSelectModalVisible(true);
            }
          }}
        >
          <View style={styles.floatingButtonContent}>
            <Ionicons name="add" size={30} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
      
      {/* Medication Selection Modal */}
      {renderMedicationSelectModal()}
      
      {/* Reminder Setting Modal */}
      {renderReminderModal()}
      
      {/* Session Switcher Modal */}
      {renderSessionSwitcherModal()}
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },  
  addReminderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3cc5b7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionButton: {
    marginRight: 10,
  },
  activeMedicationIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3cc5b7',
  },
  activeMedicationIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  sessionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f2f9f9',
    marginBottom: 10,
  },
  sessionText: {
    fontSize: 14,
    color: '#333',
  },
  sessionMedicationName: {
    fontWeight: '600',
    color: '#3cc5b7',
  },
  clearFilterButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#e4f6f6',
  },
  clearFilterText: {
    fontSize: 12,
    color: '#3cc5b7',
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3cc5b7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  monthSelectorContainer: {
    paddingTop: 5,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  monthsContainer: {
    paddingHorizontal: 16,
  },
  monthItem: {
    width: MONTH_ITEM_WIDTH,
    height: 36,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  selectedMonthItem: {
    backgroundColor: '#3cc5b7',
  },
  monthText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  selectedMonthText: {
    color: '#fff',
  },  daySelectorContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  daysContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'nowrap', // Önemli: scrollView içinde yan yana dizilim
  },
  dayItem: {
    width: 55, // Daha küçük genişlik, daha fazla gün göstermek için
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6, // Daha küçük margin
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
  },
  selectedDayItem: {
    backgroundColor: '#3cc5b7',
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dayText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedDayNumber: {
    color: '#fff',
  },
  selectedDayText: {
    color: '#fff',
  },
  scheduleContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingTop: 15,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scheduleHeaderAction: {
    fontSize: 14,
    color: '#3cc5b7',
    fontWeight: '500',
  },
  scheduleList: {
    flex: 1,
  },
   scheduleItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scheduleTime: {
    width: 50,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 15,
  },
  medicationList: {
    flex: 1,
  },  
  medicationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medicationColorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  medicationIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
  },
  medicationIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
   medicationDetails: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: '#666',
  },
  medicationStatusButton: {
    padding: 5,
  },
  
  // Empty state styles
  emptyScheduleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  emptyStateText: {
       fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 30,
  },
  addMedicationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#3cc5b7',
    borderRadius: 8,
    marginTop: 20,
  },
  addMedicationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    minHeight: '60%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  
  // Medication selection styles
  medicationSelectList: {
    paddingBottom: 20,
  },
  medicationSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeSessionItem: {
    backgroundColor: '#f2f9f9',
  },
  medicationSelectIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    marginRight: 14,
  },
  medicationSelectIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  medicationSelectDetails: {
    flex: 1,
  },
  medicationSelectName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  medicationSelectDosage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  medicationSelectTime: {
    fontSize: 13,
    color: '#3cc5b7',
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
  },
  
  // Reminder settings styles
  reminderContent: {
    paddingHorizontal: 20,
  },
  selectedMedicationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedMedicationIconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    marginRight: 15,
  },
  selectedMedicationIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  selectedMedicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  selectedMedicationDosage: {
    fontSize: 15,
    color: '#666',
  },
  reminderSettingSection: {
    marginBottom: 20,
  },
  reminderSettingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  frequencyOption: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedFrequencyOption: {
    backgroundColor: '#3cc5b7',
  },
  frequencyOptionText: {
    color: '#666',
    fontWeight: '500',
  },
  selectedFrequencyOptionText: {
    color: '#fff',
  },
  timesOfDayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeOfDayOption: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedTimeOfDayOption: {
    backgroundColor: '#3cc5b7',
  },
  timeOfDayOptionText: {
    color: '#666',
    fontWeight: '500',
  },
  selectedTimeOfDayOptionText: {
    color: '#fff',
  },
  setReminderButton: {
    backgroundColor: '#3cc5b7',
    borderRadius: 10,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setReminderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  cancelButtonText: {
    color: '#777',
    fontWeight: '500',
    fontSize: 15,
  },
  reminderDisclaimer: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
    marginBottom: 20,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3cc5b7',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Enhanced styles for day selection
  dayOption: {
    width: 45,
    height: 45, 
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    position: 'relative', // For the indicator positioning
  },
  selectedDayOption: {
    backgroundColor: '#3cc5b7',
    borderWidth: 2,
    borderColor: '#2aa396',
  },
  dayOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedDayOptionText: {
    color: '#fff',
    fontWeight: '700',
  },
  selectedDayIndicator: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 10,
  },
  daySelectionHelpers: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 15,
  },
  daySelectionHelper: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  daySelectionHelperText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  
  // Enhanced styles for time selection
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 10,
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedTimeOption: {
    backgroundColor: '#3cc5b7',
  },
  timeIcon: {
    marginRight: 6,
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  selectedTimeOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Custom time selection
  customTimeContainer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  customTimeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  customTimeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
  },
  customTimeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  customTimeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginRight: 5,
    flex: 1,
  },
  customTimeHint: {
    fontSize: 12, 
    color: '#888',
    marginTop: 5,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  
  // Debugging styles - to be removed in production
  debugContainer: {
    padding: 10,
    backgroundColor: '#fff3f3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcccc',
    margin: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#a33',
    marginBottom: 4,
  },
  dateSelectionContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    padding: 12,
    marginTop: 10,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  dateButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  miniCalendarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  miniCalendarTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 10,
  },
  monthsScrollView: {
    marginBottom: 10,
  },
  miniMonthItem: {
    width: 60,
    height: 34,
    borderRadius: 17,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  selectedMiniMonthItem: {
    backgroundColor: '#3cc5b7',
  },
  miniMonthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedMiniMonthText: {
    color: '#fff',
  },
  daysScrollView: {
    marginBottom: 10,
  },
  miniDayItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  selectedMiniDayItem: {
    backgroundColor: '#3cc5b7',
  },
  miniDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedMiniDayNumber: {
    color: '#fff',
  },
});

export default ReminderScreen;