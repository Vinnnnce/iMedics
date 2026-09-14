/**
 * Root Navigator — Role-based navigation
 * Routes to Patient, Doctor, or Lab Scientist stack based on user role.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';

// Auth screens
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

// Patient screens
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import LabResultsListScreen from '../screens/patient/LabResultsListScreen';
import LabResultDetailScreen from '../screens/patient/LabResultDetailScreen';
import LabUploadScreen from '../screens/patient/LabUploadScreen';
import AIAssistantScreen from '../screens/patient/AIAssistantScreen';

// Doctor screens
import DoctorHomeScreen from '../screens/doctor/DoctorHomeScreen';
import ConsultRoomScreen from '../screens/doctor/ConsultRoomScreen';

// Lab screens
import LabHomeScreen from '../screens/lab/LabHomeScreen';

const Stack = createNativeStackNavigator();

export type Role = 'PATIENT' | 'DOCTOR' | 'LAB_SCIENTIST' | 'ADMIN';

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SignIn" component={SignInScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const PatientStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#F5F6FA' },
    }}
  >
    <Stack.Screen name="PatientHome" component={PatientHomeScreen} />
    <Stack.Screen name="LabResultsList" component={LabResultsListScreen} />
    <Stack.Screen name="LabResultDetail" component={LabResultDetailScreen} />
    <Stack.Screen name="LabUpload" component={LabUploadScreen} />
    <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
  </Stack.Navigator>
);

const DoctorStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#F5F6FA' },
    }}
  >
    <Stack.Screen name="DoctorHome" component={DoctorHomeScreen} />
    <Stack.Screen name="ConsultRoom" component={ConsultRoomScreen} />
  </Stack.Navigator>
);

const LabStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#F5F6FA' },
    }}
  >
    <Stack.Screen name="LabHome" component={LabHomeScreen} />
  </Stack.Navigator>
);

export const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthStack />
      ) : user.role === 'PATIENT' ? (
        <PatientStack />
      ) : user.role === 'DOCTOR' ? (
        <DoctorStack />
      ) : user.role === 'LAB_SCIENTIST' ? (
        <LabStack />
      ) : (
        <PatientStack />
      )}
    </NavigationContainer>
  );
};
