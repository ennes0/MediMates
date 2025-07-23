import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import AppNavigator from './components/navigation/AppNavigator';
import { SidebarProvider } from './components/context/SidebarContext';
import { AuthProvider } from './components/context/AuthContext';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';

// Ignore specific warnings that might occur due to third-party libraries
LogBox.ignoreLogs(['Require cycle:', '[react-native-gesture-handler]']);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <AuthProvider>
            <SidebarProvider>
              <>
                <AppNavigator />
                <StatusBar style="auto" />
              </>
            </SidebarProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
