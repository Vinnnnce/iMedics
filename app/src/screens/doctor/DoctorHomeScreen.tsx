/**
 * DoctorHome Screen — Dashboard for doctors.
 * Shows patient queue, recent lab results, and AI alerts.
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import Theme from '../../theme';

const MOCK_PATIENTS = [
  { id: '1', name: 'Sarah M.', lastVisit: '2026-09-10', pendingLabs: 2, aiAlerts: 1 },
  { id: '2', name: 'John D.', lastVisit: '2026-09-08', pendingLabs: 0, aiAlerts: 0 },
  { id: '3', name: 'Maria K.', lastVisit: '2026-09-05', pendingLabs: 1, aiAlerts: 1 },
  { id: '4', name: 'Robert F.', lastVisit: '2026-08-28', pendingLabs: 0, aiAlerts: 0 },
];

const MOCK_ALERTS = [
  { id: '1', patient: 'Sarah M.', type: 'Critical HGB', severity: 'high', message: 'Hemoglobin 7.2 g/dL — critical low' },
  { id: '2', patient: 'Maria K.', type: 'Abnormal WBC', severity: 'warning', message: 'WBC elevated — consider follow-up' },
];

export default function DoctorHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 400);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Dr. {user?.name || 'Doctor'}</Text>
          <Text style={styles.subtitle}>You have {MOCK_PATIENTS.filter(p => p.aiAlerts > 0).length} AI alerts and {MOCK_PATIENTS.filter(p => p.pendingLabs > 0).length} pending lab reviews</Text>
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{MOCK_PATIENTS.length}</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Theme.Colors.high }]}>{MOCK_PATIENTS.reduce((a, p) => a + p.pendingLabs, 0)}</Text>
            <Text style={styles.statLabel}>Pending Labs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Theme.Colors.low }]}>{MOCK_ALERTS.length}</Text>
            <Text style={styles.statLabel}>AI Alerts</Text>
          </View>
        </View>

        {/* AI Alerts */}
        {MOCK_ALERTS.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI Safety Alerts</Text>
              <Text style={styles.sectionBadge}>{MOCK_ALERTS.length}</Text>
            </View>
            {MOCK_ALERTS.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, alert.severity === 'high' ? styles.alertHigh : styles.alertWarning]}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertIcon}>{alert.severity === 'high' ? '🔴' : '🟡'}</Text>
                  <Text style={styles.alertType}>{alert.type}</Text>
                </View>
                <Text style={styles.alertPatient}>Patient: {alert.patient}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <TouchableOpacity style={styles.alertAction}>
                  <Text style={styles.alertActionText}>Review →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Patient list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Patients</Text>
        </View>
        {MOCK_PATIENTS.map((patient) => (
          <TouchableOpacity
            key={patient.id}
            style={styles.patientCard}
            activeOpacity={0.9}
          >
            <View style={styles.patientInfo}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientInitial}>{patient.name.charAt(0)}</Text>
              </View>
              <View style={styles.patientDetails}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <Text style={styles.patientMeta}>Last visit: {patient.lastVisit}</Text>
              </View>
            </View>
            <View style={styles.patientBadges}>
              {patient.pendingLabs > 0 && (
                <View style={styles.badgeWarning}>
                  <Text style={styles.badgeText}>{patient.pendingLabs} labs</Text>
                </View>
              )}
              {patient.aiAlerts > 0 && (
                <View style={styles.badgeAlert}>
                  <Text style={styles.badgeText}>{patient.aiAlerts} alerts</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Consult room button */}
        <TouchableOpacity
          style={styles.consultButton}
          onPress={() => navigation.navigate('ConsultRoom' as never)}
        >
          <Text style={styles.consultIcon}>📹</Text>
          <Text style={styles.consultText}>Enter Consult Room</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => {}}>
          <Text style={[styles.tabText, styles.tabActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => {}}>
          <Text style={styles.tabText}>Patients</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => {}}>
          <Text style={styles.tabText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.Colors.background },
  header: { marginBottom: Theme.Spacing.xxl },
  greeting: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  subtitle: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, marginTop: Theme.Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Theme.Spacing.sm, marginBottom: Theme.Spacing.xxl },
  statCard: { flex: 1, backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, alignItems: 'center', ...Theme.Shadows.small },
  statNumber: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.primary },
  statLabel: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.Spacing.md, gap: Theme.Spacing.sm },
  sectionTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  sectionBadge: { backgroundColor: Theme.Colors.low, color: '#fff', fontSize: 12, fontWeight: '700', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  alertCard: { borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, borderWidth: 1, ...Theme.Shadows.small },
  alertHigh: { backgroundColor: Theme.Colors.lowBg, borderColor: Theme.Colors.low },
  alertWarning: { backgroundColor: Theme.Colors.warningBg, borderColor: Theme.Colors.warning },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.Spacing.xs },
  alertIcon: { fontSize: 16, marginRight: Theme.Spacing.sm },
  alertType: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  alertPatient: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xs },
  alertMessage: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm },
  alertAction: { alignSelf: 'flex-start' },
  alertActionText: { fontSize: Theme.Typography.caption, fontWeight: Theme.Typography.bold, color: Theme.Colors.primary },
  patientCard: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Theme.Shadows.small },
  patientInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.md },
  patientInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  patientDetails: { flex: 1 },
  patientName: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  patientMeta: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, marginTop: 2 },
  patientBadges: { flexDirection: 'row', gap: Theme.Spacing.xs },
  badgeWarning: { backgroundColor: Theme.Colors.warningBg, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.sm, paddingVertical: 2 },
  badgeAlert: { backgroundColor: Theme.Colors.lowBg, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: Theme.Colors.textPrimary },
  consultButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.lg, paddingVertical: Theme.Spacing.lg, marginTop: Theme.Spacing.lg, ...Theme.Shadows.medium },
  consultIcon: { fontSize: 20, marginRight: Theme.Spacing.sm },
  consultText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: '#fff' },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: Theme.Colors.surface, paddingVertical: Theme.Spacing.md, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight, ...Theme.Shadows.large },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Theme.Spacing.sm },
  tabText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textMuted, fontWeight: Theme.Typography.medium },
  tabActive: { color: Theme.Colors.primary, fontWeight: Theme.Typography.bold },
});
