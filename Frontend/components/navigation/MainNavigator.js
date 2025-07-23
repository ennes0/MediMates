import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import HomeScreen from '../../screens/main/HomeScreen';
import CalendarScreen from '../../screens/main/CalendarScreen';
import MedicationsScreen from '../../screens/main/MedicationsScreen';
import ReminderScreen from '../../screens/main/ReminderScreen';
import ProfileScreen from '../../screens/main/ProfileScreen';
import SettingsScreen from '../../screens/main/SettingsScreen';
import FriendsScreen from '../../screens/main/FriendsScreen';

// Import custom tab bar
import CustomTabBar from './CustomTabBar';

// Import sidebar context
import { useSidebar } from '../context/SidebarContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { sidebarVisible } = useSidebar();
  
  return (
    <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} sidebarVisible={sidebarVisible} />}
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            display: 'none', // Hide default tab bar since we're using custom one
          },
          headerShown: false, // Hide default header since we'll add our own in each screen
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen}
          options={{
            headerTitle: 'MediMates',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            ),          }} 
        />
        <Tab.Screen 
          name="Medications" 
          component={CalendarScreen}
          options={{
            headerTitle: 'Medications',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'medical' : 'medical-outline'} size={24} color={color} />
            ),
          }} 
        />        
        <Tab.Screen 
          name="Calendar" 
          component={ReminderScreen}
          options={{
            headerTitle: 'Medication Calendar',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
            ),          }}
        />
        <Tab.Screen
          name="Chat" 
          component={MedicationsScreen}
          options={{
            headerTitle: 'My Chats',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={24} color={color} />
            ),
          }}
        />
        </Tab.Navigator>
    );
};

const MainNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TabHome" component={TabNavigator} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Friends" component={FriendsScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
