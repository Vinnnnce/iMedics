import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Theme from '../../theme';

export default function DoctorHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctor Home</Text>
      {/* Doctor dashboard would go here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  title: { fontSize: 24, fontWeight: '700', color: Theme.Colors.textPrimary, padding: 20 },
});
