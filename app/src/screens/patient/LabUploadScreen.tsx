/**
 * LabUpload Screen — File upload form with category selection and manual value entry.
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Theme from '../../theme';

const CATEGORIES = [
  { value: 'CBC', label: 'Complete Blood Count' },
  { value: 'CMP', label: 'Comprehensive Metabolic Panel' },
  { value: 'LIPID', label: 'Lipid Panel' },
  { value: 'THYROID', label: 'Thyroid Function' },
  { value: 'HBA1C', label: 'HbA1c (Diabetes)' },
  { value: 'IRON', label: 'Iron Studies' },
  { value: 'LIVER', label: 'Liver Function Tests' },
  { value: 'RENAL', label: 'Renal Function Panel' },
  { value: 'IMAGING', label: 'Imaging (X-ray, CT, Ultrasound)' },
  { value: 'MICROBIOLOGY', label: 'Microbiology' },
  { value: 'HISTOPATHOLOGY', label: 'Histopathology' },
  { value: 'STOOL', label: 'Stool Analysis / Culture' },
  { value: 'SWAB', label: 'Swab Test' },
];

interface LabValueField {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

export default function LabUploadScreen() {
  const navigation = useNavigation();
  const [category, setCategory] = useState('CBC');
  const [labName, setLabName] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualEntry, setManualEntry] = useState(false);
  const [values, setValues] = useState<LabValueField[]>([
    { code: '', name: '', value: '', unit: '', refLow: '', refHigh: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addValueField = () => {
    setValues([...values, { code: '', name: '', value: '', unit: '', refLow: '', refHigh: '' }]);
  };

  const removeValueField = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const updateValue = (index: number, field: keyof LabValueField, text: string) => {
    const updated = [...values];
    updated[index] = { ...updated[index], [field]: text };
    setValues(updated);
  };

  const handleSubmit = async () => {
    if (!labName) {
      Alert.alert('Missing info', 'Please enter the lab name.');
      return;
    }
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert(
        'Results uploaded',
        'Your lab results have been submitted for AI analysis. You will be notified when the AI summary is ready.',
        [{ text: 'OK', onPress: () => navigation.navigate('LabResultsList') }]
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Upload Lab Results</Text>
        <Text style={styles.subtitle}>Upload a file or enter values manually for AI analysis</Text>

        {/* Category selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Test Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryChip, category === cat.value && styles.categoryChipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[styles.categoryText, category === cat.value && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lab info */}
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Lab Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., CityLab Frankfurt"
              placeholderTextColor={Theme.Colors.textMuted}
              value={labName}
              onChangeText={setLabName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Test Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Theme.Colors.textMuted}
              value={testDate}
              onChangeText={setTestDate}
            />
          </View>
        </View>

        {/* File upload area */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Upload File (PDF, Image)</Text>
          <TouchableOpacity style={styles.uploadArea}>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadText}>Tap to select a file</Text>
            <Text style={styles.uploadHint}>PDF, JPG, PNG — max 10MB</Text>
          </TouchableOpacity>
        </View>

        {/* Manual entry toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Enter values manually</Text>
          <Switch
            value={manualEntry}
            onValueChange={setManualEntry}
            trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Manual value fields */}
        {manualEntry && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Lab Values</Text>
            {values.map((field, index) => (
              <View key={index} style={styles.valueCard}>
                <View style={styles.valueCardHeader}>
                  <Text style={styles.valueCardTitle}>Value #{index + 1}</Text>
                  {values.length > 1 && (
                    <TouchableOpacity onPress={() => removeValueField(index)}>
                      <Text style={styles.removeButton}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.valueRow}>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="HGB"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.code}
                      onChangeText={(t) => updateValue(index, 'code', t)}
                    />
                  </View>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Test Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Hemoglobin"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.name}
                      onChangeText={(t) => updateValue(index, 'name', t)}
                    />
                  </View>
                </View>
                <View style={styles.valueRow}>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Value</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="14.5"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.value}
                      onChangeText={(t) => updateValue(index, 'value', t)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="g/dL"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.unit}
                      onChangeText={(t) => updateValue(index, 'unit', t)}
                    />
                  </View>
                </View>
                <View style={styles.valueRow}>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Ref Low</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="12"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.refLow}
                      onChangeText={(t) => updateValue(index, 'refLow', t)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.valueFieldHalf}>
                    <Text style={styles.label}>Ref High</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="16"
                      placeholderTextColor={Theme.Colors.textMuted}
                      value={field.refHigh}
                      onChangeText={(t) => updateValue(index, 'refHigh', t)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addButton} onPress={addValueField}>
              <Text style={styles.addButtonText}>+ Add Another Value</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit for AI Analysis</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          AI explanations are informational only, not a medical diagnosis. Always consult your doctor for clinical decisions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xs },
  subtitle: { fontSize: Theme.Typography.body, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xxl },
  section: { marginBottom: Theme.Spacing.xxl },
  sectionLabel: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.Spacing.sm },
  categoryChip: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.sm, borderWidth: 1, borderColor: Theme.Colors.border, ...Theme.Shadows.small },
  categoryChipActive: { backgroundColor: Theme.Colors.primary, borderColor: Theme.Colors.primary },
  categoryText: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary },
  categoryTextActive: { color: '#fff', fontWeight: Theme.Typography.bold },
  inputGroup: { marginBottom: Theme.Spacing.lg },
  label: { fontSize: Theme.Typography.caption, fontWeight: Theme.Typography.medium, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xs },
  input: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.md, fontSize: Theme.Typography.body, color: Theme.Colors.textPrimary, borderWidth: 1, borderColor: Theme.Colors.border },
  uploadArea: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, borderWidth: 2, borderColor: Theme.Colors.border, borderStyle: 'dashed', paddingVertical: Theme.Spacing.xxxl, alignItems: 'center', justifyContent: 'center' },
  uploadIcon: { fontSize: 40, marginBottom: Theme.Spacing.sm },
  uploadText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.primary },
  uploadHint: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, marginTop: Theme.Spacing.xs },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.Spacing.xxl, backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, padding: Theme.Spacing.lg, ...Theme.Shadows.small },
  toggleLabel: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  valueCard: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, ...Theme.Shadows.small },
  valueCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.Spacing.md },
  valueCardTitle: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  removeButton: { fontSize: Theme.Typography.caption, color: Theme.Colors.low, fontWeight: Theme.Typography.medium },
  valueRow: { flexDirection: 'row', gap: Theme.Spacing.sm, marginBottom: Theme.Spacing.sm },
  valueFieldHalf: { flex: 1 },
  addButton: { backgroundColor: Theme.Colors.surfaceTint, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Theme.Colors.primary, borderStyle: 'dashed' },
  addButtonText: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.primary },
  submitButton: { backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', marginBottom: Theme.Spacing.lg, ...Theme.Shadows.medium },
  submitButtonText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: Theme.Colors.textInverse },
  disclaimer: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, textAlign: 'center', lineHeight: Theme.Typography.lineHeightCaption },
});
