/**
 * LabHome Screen — Dashboard for lab scientists.
 * Worklist with pending results, QC overview, and verification queue.
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
import { useAuth } from '../../hooks/useAuth';
import Theme from '../../theme';

const MOCK_WORKLIST = [
  { id: '1', patient: 'Sarah M.', panel: 'CBC', status: 'PENDING_AI_ANALYSIS', uploadedAt: '2026-09-14 10:30', hasFile: true },
  { id: '2', patient: 'John D.', panel: 'LIPID', status: 'AI_ANALYSIS_COMPLETE', uploadedAt: '2026-09-14 09:15', hasFile: true },
  { id: '3', patient: 'Maria K.', panel: 'THYROID', status: 'PENDING', uploadedAt: '2026-09-13 16:00', hasFile: false },
  { id: '4', patient: 'Robert F.', panel: 'CMP', status: 'VERIFIED', uploadedAt: '2026-09-12 14:20', hasFile: true },
];

export default function LabHomeScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('worklist');

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

  const pending = MOCK_WORKLIST.filter(r => r.status === 'PENDING' || r.status === 'PENDING_AI_ANALYSIS');
  const ready = MOCK_WORKLIST.filter(r => r.status === 'AI_ANALYSIS_COMPLETE');
  const verified = MOCK_WORKLIST.filter(r => r.status === 'VERIFIED');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Lab Dashboard</Text>
          <Text style={styles.subtitle}>Welcome, {user?.name || 'Lab Scientist'}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Theme.Colors.high }]}>{pending.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Theme.Colors.primary }]}>{ready.length}</Text>
            <Text style={styles.statLabel}>AI Ready</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: Theme.Colors.normal }]}>{verified.length}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {/* QC Overview */}
        <View style={styles.qcCard}>
          <View style={styles.qcHeader}>
            <Text style={styles.qcIcon}>🔍</Text>
            <Text style={styles.qcTitle}>QC Overview</Text>
          </View>
          <View style={styles.qcRow}>
            <Text style={styles.qcLabel}>Outliers detected</Text>
            <Text style={styles.qcValue}>1</Text>
          </View>
          <View style={styles.qcRow}>
            <Text style={styles.qcLabel}>Missing tests</Text>
            <Text style={styles.qcValue}>0</Text>
          </View>
          <View style={styles.qcRow}>
            <Text style={styles.qcLabel}>Panel consistency</Text>
            <Text style={[styles.qcValue, { color: Theme.Colors.normal }]}>OK</Text>
          </View>
        </View>

        {/* Worklist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Worklist</Text>
        </View>

        {MOCK_WORKLIST.map((item) => {
          const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
            PENDING: { label: 'Pending', color: Theme.Colors.warning, bg: Theme.Colors.warningBg },
            PENDING_AI_ANALYSIS: { label: 'AI Processing', color: Theme.Colors.primary, bg: Theme.Colors.aiBg },
            AI_ANALYSIS_COMPLETE: { label: 'AI Ready', color: Theme.Colors.accentTeal, bg: Theme.Colors.normalBg },
            VERIFIED: { label: 'Verified', color: Theme.Colors.normal, bg: Theme.Colors.normalBg },
          };
          const sc = statusConfig[item.status] || statusConfig.PENDING;
          return (
            <View key={item.id} style={styles.workItem}>
              <View style={styles.workHeader}>
                <View style={styles.workInfo}>
                  <Text style={styles.workPatient}>{item.patient}</Text>
                  <Text style={styles.workPanel}>{item.panel}</Text>
                  <Text style={styles.workTime}>{item.uploadedAt}</Text>
                </View>
                <View style={[styles.workBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.workBadgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>
              <View style={styles.workActions}>
                {item.hasFile && (
                  <TouchableOpacity style={styles.workButton}>
                    <Text style={styles.workButtonText}>📄 View File</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'AI_ANALYSIS_COMPLETE' && (
                  <TouchableOpacity style={[styles.workButton, styles.workButtonPrimary]}>
                    <Text style={styles.workButtonTextPrimary}>✓ Verify</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'PENDING' && (
                  <TouchableOpacity style={[styles.workButton, styles.workButtonPrimary]}>
                    <Text style={styles.workButtonTextPrimary}>🤖 Run AI</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  statNumber: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold },
  statLabel: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  qcCard: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.xxl, ...Theme.Shadows.small },
  qcHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.Spacing.md },
  qcIcon: { fontSize: 20, marginRight: Theme.Spacing.sm },
  qcTitle: { fontSize: Theme.Typography.subheading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  qcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Theme.Spacing.sm, borderBottomWidth: 1, borderBottomColor: Theme.Colors.borderLight },
  qcLabel: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary },
  qcValue: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  sectionHeader: { marginBottom: Theme.Spacing.md },
  sectionTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  workItem: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, ...Theme.Shadows.small },
  workHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Theme.Spacing.md },
  workInfo: { flex: 1 },
  workPatient: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  workPanel: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.primary, marginTop: 2 },
  workTime: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, marginTop: 2 },
  workBadge: { borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.md, paddingVertical: Theme.Spacing.xs },
  workBadgeText: { fontSize: Theme.Typography.caption, fontWeight: Theme.Typography.bold },
  workActions: { flexDirection: 'row', gap: Theme.Spacing.sm },
  workButton: { backgroundColor: Theme.Colors.background, borderRadius: Theme.BorderRadius.md, paddingHorizontal: Theme.Spacing.md, paddingVertical: Theme.Spacing.sm, borderWidth: 1, borderColor: Theme.Colors.border },
  workButtonText: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, fontWeight: Theme.Typography.medium },
  workButtonPrimary: { backgroundColor: Theme.Colors.primary, borderColor: Theme.Colors.primary },
  workButtonTextPrimary: { fontSize: Theme.Typography.caption, color: '#fff', fontWeight: Theme.Typography.bold },
});
