/**
 * ConsultRoom Screen — Video consult interface with lab results + AI summary sidebar.
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Theme from '../../theme';

export default function ConsultRoomScreen() {
  const navigation = useNavigation();
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [showLabPanel, setShowLabPanel] = useState(true);
  const [callDuration, setCallDuration] = useState('00:00');

  return (
    <SafeAreaView style={styles.container}>
      {/* Main video area */}
      <View style={styles.videoArea}>
        <View style={styles.remoteVideo}>
          <View style={styles.videoPlaceholder}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>SM</Text>
            </View>
            <Text style={styles.patientName}>Sarah M.</Text>
            <Text style={styles.callDuration}>{callDuration}</Text>
          </View>
        </View>

        {/* Self preview */}
        <View style={styles.selfVideo}>
          <View style={styles.selfPlaceholder}>
            <Text style={styles.selfText}>You</Text>
          </View>
        </View>

        {/* Call controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, !videoOn && styles.controlOff]}
          >
            <Text style={styles.controlIcon} onPress={() => setVideoOn(!videoOn)}>
              {videoOn ? '📹' : '📷'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, !audioOn && styles.controlOff]}
          >
            <Text style={styles.controlIcon} onPress={() => setAudioOn(!audioOn)}>
              {audioOn ? '🎤' : '🔇'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.controlIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lab results panel */}
      {showLabPanel && (
        <View style={styles.labPanel}>
          <View style={styles.labPanelHeader}>
            <Text style={styles.labPanelTitle}>Lab Results — CBC</Text>
            <TouchableOpacity>
              <Text style={styles.labPanelClose} onPress={() => setShowLabPanel(false)}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* AI Summary */}
          <View style={styles.aiSummaryCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>AI Summary (Doctor View)</Text>
            </View>
            <View style={styles.aiFlagRow}>
              <View style={[styles.flagChip, styles.flagLow]}>
                <Text style={styles.flagChipText}>HGB LOW (9.8)</Text>
              </View>
              <View style={[styles.flagChip, styles.flagHigh]}>
                <Text style={styles.flagChipText}>WBC HIGH (11.2)</Text>
              </View>
            </View>
            <Text style={styles.aiBullet}>• Hemoglobin below reference — consider iron studies</Text>
            <Text style={styles.aiBullet}>• WBC mildly elevated — rule out infection</Text>
            <Text style={styles.aiBullet}>• Platelets within normal range</Text>
            <Text style={styles.aiSuggestion}>Suggested: Iron panel, ferritin, CRP</Text>
          </View>

          {/* Quick values */}
          <View style={styles.valuesList}>
            <View style={styles.valueRow}>
              <Text style={styles.valueName}>Hemoglobin</Text>
              <Text style={[styles.valueResult, { color: Theme.Colors.low }]}>9.8 ↓</Text>
              <Text style={styles.valueRange}>12-16 g/dL</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueName}>WBC</Text>
              <Text style={[styles.valueResult, { color: Theme.Colors.high }]}>11.2 ↑</Text>
              <Text style={styles.valueRange}>4.5-11 K/μL</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.valueName}>Platelets</Text>
              <Text style={[styles.valueResult, { color: Theme.Colors.normal }]}>245 ✓</Text>
              <Text style={styles.valueRange}>150-400 K/μL</Text>
            </View>
          </View>

          {/* Chat */}
          <TouchableOpacity style={styles.chatButton}>
            <Text style={styles.chatIcon}>💬</Text>
            <Text style={styles.chatText}>Open chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toggle lab panel */}
      {!showLabPanel && (
        <TouchableOpacity
          style={styles.showPanelButton}
          onPress={() => setShowLabPanel(true)}
        >
          <Text style={styles.showPanelText}>📋 Show Lab Results</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  videoArea: { flex: 1, position: 'relative' },
  remoteVideo: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  videoPlaceholder: { alignItems: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  patientName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  callDuration: { fontSize: 14, color: '#888', marginTop: 4 },
  selfVideo: { position: 'absolute', top: 16, right: 16, width: 100, height: 140, borderRadius: 12, backgroundColor: '#2a2a4e', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  selfPlaceholder: { alignItems: 'center' },
  selfText: { fontSize: 12, color: '#aaa' },
  controls: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  controlButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  controlOff: { backgroundColor: 'rgba(231,76,60,0.3)' },
  endCallButton: { backgroundColor: Theme.Colors.low },
  controlIcon: { fontSize: 24 },
  labPanel: { maxHeight: '45%', backgroundColor: Theme.Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, ...Theme.Shadows.large },
  labPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  labPanelTitle: { fontSize: 16, fontWeight: '700', color: Theme.Colors.textPrimary },
  labPanelClose: { fontSize: 18, color: Theme.Colors.textMuted },
  aiSummaryCard: { backgroundColor: Theme.Colors.aiBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  aiIcon: { fontSize: 18, marginRight: 6 },
  aiTitle: { fontSize: 14, fontWeight: '700', color: Theme.Colors.primary },
  aiFlagRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flagChip: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  flagLow: { backgroundColor: Theme.Colors.lowBg },
  flagHigh: { backgroundColor: Theme.Colors.highBg },
  flagChipText: { fontSize: 11, fontWeight: '700' },
  aiBullet: { fontSize: 13, color: Theme.Colors.textPrimary, marginBottom: 4, lineHeight: 18 },
  aiSuggestion: { fontSize: 12, color: Theme.Colors.primary, fontWeight: '600', marginTop: 4 },
  valuesList: { marginBottom: 12 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Theme.Colors.borderLight },
  valueName: { fontSize: 14, color: Theme.Colors.textPrimary, flex: 1 },
  valueResult: { fontSize: 14, fontWeight: '700', width: 80, textAlign: 'center' },
  valueRange: { fontSize: 12, color: Theme.Colors.textMuted, width: 100, textAlign: 'right' },
  chatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.Colors.primary, borderRadius: 12, paddingVertical: 12 },
  chatIcon: { fontSize: 16, marginRight: 8 },
  chatText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  showPanelButton: { position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: Theme.Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  showPanelText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
