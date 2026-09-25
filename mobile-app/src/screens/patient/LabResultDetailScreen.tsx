/**
 * Lab Result Detail Screen — Shows AI explanation and detailed lab values.
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
  Linking,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Theme from '../../theme';

interface LabValue {
  code: string;
  name: string;
  value: number;
  unit: string;
  ref_low?: number;
  ref_high?: number;
  flag: string;
  is_critical?: boolean;
}

interface AIAnalysis {
  doctor_view: any;
  patient_view: {
    language: string;
    title: string;
    body: string[];
    questions_for_doctor: string[];
  };
  urgency_level: string;
  confidence: { level: string; reasons: string[] };
}

export default function LabResultDetailScreen() {
  const route = useRoute();
  const { resultId } = route.params as { resultId: string };
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);

  useEffect(() => {
    // Fetch result + AI analysis
    // This would call the API service
    setTimeout(() => {
      setResult({
        panel_type: 'CBC',
        test_date: '2026-09-14',
        lab_name: 'CityLab Frankfurt',
        values: [
          { code: 'HGB', name: 'Hemoglobin', value: 9.8, unit: 'g/dL', ref_low: 12, ref_high: 16, flag: 'LOW', is_critical: false },
          { code: 'WBC', name: 'White Blood Cell Count', value: 11.2, unit: '10³/μL', ref_low: 4.5, ref_high: 11, flag: 'HIGH', is_critical: false },
          { code: 'PLT', name: 'Platelet Count', value: 245, unit: '10³/μL', ref_low: 150, ref_high: 400, flag: 'NORMAL', is_critical: false },
        ],
        file_url: 's3://imedics-lab-results/patient/report.pdf',
      });
      setAiAnalysis({
        doctor_view: {},
        patient_view: {
          language: 'en',
          title: 'Your Blood Test Results in Brief',
          body: [
            'Some of your blood test results are outside the usual range. This doesn\'t automatically mean something is wrong, but it\'s worth discussing with your doctor.',
            'The good news is that your hemoglobin levels have improved since your last test in August.',
          ],
          questions_for_doctor: [
            'Which results are most important to monitor?',
            'Should I repeat these tests, and when?',
            'Are there any lifestyle changes I should consider?',
          ],
        },
        urgency_level: 'soon',
        confidence: { level: 'medium', reasons: ['Trend data available for HGB comparison'] },
      });
      setLoading(false);
    }, 500);
  }, [resultId]);

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'LOW': return Theme.Colors.low;
      case 'HIGH': return Theme.Colors.high;
      case 'NORMAL': return Theme.Colors.normal;
      default: return Theme.Colors.textSecondary;
    }
  };

  const getFlagIcon = (flag: string) => {
    switch (flag) {
      case 'LOW': return '↓';
      case 'HIGH': return '↑';
      case 'NORMAL': return '✓';
      default: return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.Colors.primary} />
      </View>
    );
  }

  const patientView = aiAnalysis?.patient_view;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backText}>← CBC Results — Sep 14</Text>
        </TouchableOpacity>

        {/* AI Summary Card */}
        {patientView && (
          <View style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>AI Health Summary</Text>
            </View>
            <Text style={styles.aiResultTitle}>{patientView.title}</Text>
            {patientView.body.map((paragraph, i) => (
              <Text key={i} style={styles.aiBody}>{paragraph}</Text>
            ))}
            <View style={styles.questionsBox}>
              <Text style={styles.questionsTitle}>Questions you can ask your doctor:</Text>
              {patientView.questions_for_doctor.map((q, i) => (
                <Text key={i} style={styles.questionItem}>• {q}</Text>
              ))}
            </View>
            <Text style={styles.disclaimer}>
              ⚠️ AI is assistive, not a medical decision-maker.
            </Text>
          </View>
        )}

        {/* Detailed Results */}
        <Text style={styles.sectionTitle}>Detailed Results</Text>
        {result?.values.map((value: LabValue, index: number) => (
          <View key={index} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultName}>{value.name}</Text>
              <Text style={[styles.resultFlag, { color: getFlagColor(value.flag) }]}>
                {value.value} {getFlagIcon(value.flag)} {value.flag}
              </Text>
            </View>
            <Text style={styles.resultRange}>
              Range: {value.ref_low}–{value.ref_high} {value.unit}
            </Text>
          </View>
        ))}

        {/* View original report */}
        <TouchableOpacity style={styles.fileCard} onPress={() => {}}>
          <Text style={styles.fileIcon}>📄</Text>
          <Text style={styles.fileText}>View original report (PDF)</Text>
        </TouchableOpacity>

        {/* Ask AI */}
        <TouchableOpacity style={styles.askAiCard} onPress={() => {}}>
          <Text style={styles.askAiIcon}>💬</Text>
          <Text style={styles.askAiText}>Ask AI about these results</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.Colors.background,
  },
  scrollContent: {
    padding: Theme.Spacing.xl,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.Colors.background,
  },
  backButton: {
    marginBottom: Theme.Spacing.lg,
  },
  backText: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.primary,
    fontWeight: Theme.Typography.medium,
  },
  aiCard: {
    backgroundColor: Theme.Colors.aiBg,
    borderRadius: Theme.BorderRadius.xl,
    padding: Theme.Spacing.xl,
    marginBottom: Theme.Spacing.xxl,
    ...Theme.Shadows.small,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.Spacing.md,
  },
  aiIcon: {
    fontSize: 24,
    marginRight: Theme.Spacing.sm,
  },
  aiTitle: {
    fontSize: Theme.Typography.subheading,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.primary,
  },
  aiResultTitle: {
    fontSize: Theme.Typography.heading,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
    marginBottom: Theme.Spacing.sm,
  },
  aiBody: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.textPrimary,
    lineHeight: Theme.Typography.lineHeightBody,
    marginBottom: Theme.Spacing.sm,
  },
  questionsBox: {
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.md,
    padding: Theme.Spacing.lg,
    marginTop: Theme.Spacing.md,
    borderWidth: 1,
    borderColor: Theme.Colors.border,
  },
  questionsTitle: {
    fontSize: Theme.Typography.bodySmall,
    fontWeight: Theme.Typography.semibold,
    color: Theme.Colors.textPrimary,
    marginBottom: Theme.Spacing.sm,
  },
  questionItem: {
    fontSize: Theme.Typography.bodySmall,
    color: Theme.Colors.textSecondary,
    marginBottom: Theme.Spacing.xs,
  },
  disclaimer: {
    fontSize: Theme.Typography.caption,
    color: Theme.Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Theme.Spacing.md,
  },
  sectionTitle: {
    fontSize: Theme.Typography.heading,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
    marginBottom: Theme.Spacing.md,
  },
  resultCard: {
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.lg,
    padding: Theme.Spacing.lg,
    marginBottom: Theme.Spacing.md,
    ...Theme.Shadows.small,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.Spacing.xs,
  },
  resultName: {
    fontSize: Theme.Typography.body,
    fontWeight: Theme.Typography.semibold,
    color: Theme.Colors.textPrimary,
    flex: 1,
  },
  resultFlag: {
    fontSize: Theme.Typography.body,
    fontWeight: Theme.Typography.bold,
  },
  resultRange: {
    fontSize: Theme.Typography.caption,
    color: Theme.Colors.textSecondary,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.lg,
    padding: Theme.Spacing.lg,
    marginBottom: Theme.Spacing.md,
    ...Theme.Shadows.small,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: Theme.Spacing.md,
  },
  fileText: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.primary,
    fontWeight: Theme.Typography.medium,
  },
  askAiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.Colors.primary,
    borderRadius: Theme.BorderRadius.lg,
    padding: Theme.Spacing.lg,
    marginBottom: Theme.Spacing.md,
    ...Theme.Shadows.medium,
  },
  askAiIcon: {
    fontSize: 20,
    marginRight: Theme.Spacing.sm,
  },
  askAiText: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.textInverse,
    fontWeight: Theme.Typography.bold,
  },
});
