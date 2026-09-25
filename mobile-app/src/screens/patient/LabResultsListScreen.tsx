/**
 * LabResultsList Screen — Lists all lab results with status badges.
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
import Theme from '../../theme';

interface LabResult {
  id: string;
  panelType: string;
  testDate: string;
  labName: string;
  status: string;
  hasAI: boolean;
}

const MOCK_RESULTS: LabResult[] = [
  { id: '1', panelType: 'CBC', testDate: '2026-09-14', labName: 'CityLab Frankfurt', status: 'AI_ANALYSIS_COMPLETE', hasAI: true },
  { id: '2', panelType: 'LIPID', testDate: '2026-09-01', labName: 'BioMed Lab', status: 'VERIFIED', hasAI: true },
  { id: '3', panelType: 'THYROID', testDate: '2026-08-15', labName: 'CityLab Frankfurt', status: 'PENDING_AI_ANALYSIS', hasAI: false },
  { id: '4', panelType: 'CMP', testDate: '2026-07-20', labName: 'MedTest Center', status: 'VERIFIED', hasAI: true },
  { id: '5', panelType: 'HBA1C', testDate: '2026-06-10', labName: 'BioMed Lab', status: 'VERIFIED', hasAI: true },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: Theme.Colors.warning, bg: Theme.Colors.warningBg },
  PENDING_AI_ANALYSIS: { label: 'AI Processing', color: Theme.Colors.primary, bg: Theme.Colors.aiBg },
  AI_ANALYSIS_COMPLETE: { label: 'AI Ready', color: Theme.Colors.accentTeal, bg: Theme.Colors.normalBg },
  VERIFIED: { label: 'Verified', color: Theme.Colors.normal, bg: Theme.Colors.normalBg },
  REJECTED: { label: 'Rejected', color: Theme.Colors.low, bg: Theme.Colors.lowBg },
};

export default function LabResultsListScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<LabResult[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setLoading(false);
    }, 500);
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
        <Text style={styles.title}>Your Lab Results</Text>
        <Text style={styles.subtitle}>{results.length} results on record</Text>

        {/* Upload button */}
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => navigation.navigate('LabUpload')}
        >
          <Text style={styles.uploadIcon}>+</Text>
          <Text style={styles.uploadText}>Upload New Results</Text>
        </TouchableOpacity>

        {/* Results list */}
        {results.map((result) => {
          const statusConfig = STATUS_CONFIG[result.status] || STATUS_CONFIG.PENDING;
          return (
            <TouchableOpacity
              key={result.id}
              style={styles.resultCard}
              onPress={() => navigation.navigate('LabResultDetail', { resultId: result.id })}
              activeOpacity={0.9}
            >
              <View style={styles.resultHeader}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultPanel}>{result.panelType}</Text>
                  <Text style={styles.resultLab}>{result.labName}</Text>
                  <Text style={styles.resultDate}>{result.testDate}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
              {result.hasAI && (
                <View style={styles.aiBadge}>
                  <Text style={styles.aiIcon}>🤖</Text>
                  <Text style={styles.aiText}>AI summary available</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {results.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No results yet</Text>
            <Text style={styles.emptyText}>Upload your first lab results to get AI-powered insights.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.Colors.background },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xs },
  subtitle: { fontSize: Theme.Typography.body, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xxl },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.lg, paddingVertical: Theme.Spacing.lg, marginBottom: Theme.Spacing.xxl, ...Theme.Shadows.medium },
  uploadIcon: { fontSize: 22, color: '#fff', fontWeight: '700', marginRight: Theme.Spacing.sm },
  uploadText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: Theme.Colors.textInverse },
  resultCard: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, ...Theme.Shadows.small },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  resultInfo: { flex: 1 },
  resultPanel: { fontSize: Theme.Typography.subheading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  resultLab: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, marginTop: 2 },
  resultDate: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.md, paddingVertical: Theme.Spacing.xs },
  statusText: { fontSize: Theme.Typography.caption, fontWeight: Theme.Typography.bold },
  aiBadge: { flexDirection: 'row', alignItems: 'center', marginTop: Theme.Spacing.md, paddingTop: Theme.Spacing.md, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight },
  aiIcon: { fontSize: 14, marginRight: Theme.Spacing.xs },
  aiText: { fontSize: Theme.Typography.caption, color: Theme.Colors.accentTeal, fontWeight: Theme.Typography.medium },
  emptyState: { alignItems: 'center', paddingVertical: Theme.Spacing.xxxl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: Theme.Spacing.lg },
  emptyTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xs },
  emptyText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, textAlign: 'center' },
});
