import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Theme from '../../theme';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join iMedics to get started</Text>
      {/* Sign-up form would go here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.Colors.background },
  title: { fontSize: 28, fontWeight: '700', color: Theme.Colors.primary },
  subtitle: { fontSize: 16, color: Theme.Colors.textSecondary, marginTop: 8 },
});
