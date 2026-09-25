/**
 * Appointments Screen — Book appointments with calendar view and form.
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
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Theme from '../../theme';

const DOCTORS = [
  { id: '1', name: 'Dr. Anna Schmidt', specialty: 'General Medicine', rating: 4.8, available: ['09:00', '10:00', '11:00', '14:00', '15:00'] },
  { id: '2', name: 'Dr. Boris Petrov', specialty: 'Cardiology', rating: 4.6, available: ['08:00', '09:00', '13:00', '16:00'] },
  { id: '3', name: 'Dr. Clara Weiss', specialty: 'Endocrinology', rating: 4.9, available: ['10:00', '11:00', '14:00', '15:00', '16:00'] },
  { id: '4', name: 'Dr. Dmitry Volkov', specialty: 'Dermatology', rating: 4.5, available: ['09:00', '12:00', '15:00'] },
];

const UPCOMING_APPOINTMENTS = [
  { id: '1', doctor: 'Dr. Anna Schmidt', date: '2026-09-16', time: '10:00', status: 'CONFIRMED', reason: 'Follow-up CBC discussion' },
];

const DATES = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'];

export default function AppointmentsScreen() {
  const navigation = useNavigation();
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('2026-09-16');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const doctor = DOCTORS.find(d => d.id === selectedDoctor);

  const handleBook = () => {
    if (!selectedDoctor || !selectedTime) return;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      setSelectedDoctor(null);
      setSelectedTime(null);
      setReason('');
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Appointments</Text>

        {/* Upcoming appointments */}
        {UPCOMING_APPOINTMENTS.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {UPCOMING_APPOINTMENTS.map((apt) => (
              <View key={apt.id} style={styles.upcomingCard}>
                <View style={styles.upcomingDate}>
                  <Text style={styles.upcomingDay}>16</Text>
                  <Text style={styles.upcomingMonth}>SEP</Text>
                </View>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingDoctor}>{apt.doctor}</Text>
                  <Text style={styles.upcomingTime}>{apt.time} · {apt.status}</Text>
                  <Text style={styles.upcomingReason}>{apt.reason}</Text>
                </View>
                <TouchableOpacity style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Book new appointment */}
        <Text style={styles.sectionTitle}>Book a New Appointment</Text>

        {/* Doctor selection */}
        <Text style={styles.label}>Select Doctor</Text>
        {DOCTORS.map((doc) => (
          <TouchableOpacity
            key={doc.id}
            style={[styles.doctorCard, selectedDoctor === doc.id && styles.doctorCardActive]}
            onPress={() => setSelectedDoctor(doc.id)}
          >
            <View style={styles.doctorAvatar}>
              <Text style={styles.doctorInitial}>{doc.name.split(' ').slice(-1)[0][0]}</Text>
            </View>
            <View style={styles.doctorInfo}>
              <Text style={styles.doctorName}>{doc.name}</Text>
              <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
            </View>
            <View style={styles.doctorRating}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingText}>{doc.rating}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Date selection */}
        {selectedDoctor && (
          <>
            <Text style={styles.label}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {DATES.map((date) => {
                const day = date.split('-')[2];
                return (
                  <TouchableOpacity
                    key={date}
                    style={[styles.dateChip, selectedDate === date && styles.dateChipActive]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[styles.dateText, selectedDate === date && styles.dateTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time selection */}
            <Text style={styles.label}>Available Times</Text>
            <View style={styles.timeGrid}>
              {doctor?.available.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeChip, selectedTime === time && styles.timeChipActive]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={[styles.timeText, selectedTime === time && styles.timeTextActive]}>{time}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reason */}
            <Text style={styles.label}>Reason for Visit (optional)</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Briefly describe your concern..."
              placeholderTextColor={Theme.Colors.textMuted}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={300}
            />

            {/* Book button */}
            <TouchableOpacity
              style={[styles.bookButton, (!selectedDoctor || !selectedTime) && styles.bookButtonDisabled]}
              onPress={handleBook}
              disabled={!selectedDoctor || !selectedTime}
            >
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          </>
        )}

        {confirmed && (
          <View style={styles.confirmedBanner}>
            <Text style={styles.confirmedIcon}>✓</Text>
            <Text style={styles.confirmedText}>Appointment booked successfully!</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirmation modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Appointment</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Doctor:</Text>
              <Text style={styles.modalValue}>{doctor?.name}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Date:</Text>
              <Text style={styles.modalValue}>{selectedDate}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Time:</Text>
              <Text style={styles.modalValue}>{selectedTime}</Text>
            </View>
            {reason ? (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Reason:</Text>
                <Text style={styles.modalValue}>{reason}</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowConfirm(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleConfirm}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xxl },
  sectionTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.md, marginTop: Theme.Spacing.xl },
  upcomingCard: { flexDirection: 'row', backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, alignItems: 'center', ...Theme.Shadows.small },
  upcomingDate: { width: 50, height: 50, borderRadius: 12, backgroundColor: Theme.Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.md },
  upcomingDay: { fontSize: 18, fontWeight: '700', color: '#fff' },
  upcomingMonth: { fontSize: 10, color: '#fff' },
  upcomingInfo: { flex: 1 },
  upcomingDoctor: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  upcomingTime: { fontSize: Theme.Typography.caption, color: Theme.Colors.primary, marginTop: 2 },
  upcomingReason: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  joinButton: { backgroundColor: Theme.Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  joinButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  label: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm, marginTop: Theme.Spacing.lg },
  doctorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.sm, borderWidth: 2, borderColor: 'transparent', ...Theme.Shadows.small },
  doctorCardActive: { borderColor: Theme.Colors.primary, backgroundColor: Theme.Colors.surfaceTint },
  doctorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.md },
  doctorInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  doctorSpecialty: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  doctorRating: { flexDirection: 'row', alignItems: 'center' },
  ratingStar: { fontSize: 14, color: Theme.Colors.accentAmber, marginRight: 4 },
  ratingText: { fontSize: Theme.Typography.caption, fontWeight: '700', color: Theme.Colors.textPrimary },
  dateScroll: { marginBottom: Theme.Spacing.sm },
  dateChip: { width: 48, height: 56, borderRadius: 12, backgroundColor: Theme.Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.sm, borderWidth: 1, borderColor: Theme.Colors.border, ...Theme.Shadows.small },
  dateChipActive: { backgroundColor: Theme.Colors.primary, borderColor: Theme.Colors.primary },
  dateText: { fontSize: 18, fontWeight: '700', color: Theme.Colors.textPrimary },
  dateTextActive: { color: '#fff' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.Spacing.sm, marginBottom: Theme.Spacing.lg },
  timeChip: { backgroundColor: Theme.Colors.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Theme.Colors.border, ...Theme.Shadows.small },
  timeChipActive: { backgroundColor: Theme.Colors.primary, borderColor: Theme.Colors.primary },
  timeText: { fontSize: 14, fontWeight: '600', color: Theme.Colors.textPrimary },
  timeTextActive: { color: '#fff' },
  reasonInput: { backgroundColor: Theme.Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: Theme.Colors.textPrimary, borderWidth: 1, borderColor: Theme.Colors.border, minHeight: 80, marginBottom: Theme.Spacing.lg },
  bookButton: { backgroundColor: Theme.Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', ...Theme.Shadows.medium },
  bookButtonDisabled: { backgroundColor: Theme.Colors.border },
  bookButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.Colors.normalBg, borderRadius: 12, padding: 16, marginTop: 16, gap: 8 },
  confirmedIcon: { fontSize: 20, color: Theme.Colors.normal },
  confirmedText: { fontSize: 16, fontWeight: '700', color: Theme.Colors.normal },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: Theme.Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, ...Theme.Shadows.large },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Theme.Colors.textPrimary, marginBottom: 16, textAlign: 'center' },
  modalRow: { flexDirection: 'row', marginBottom: 12 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: Theme.Colors.textSecondary, width: 80 },
  modalValue: { fontSize: 14, color: Theme.Colors.textPrimary, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, backgroundColor: Theme.Colors.background, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Theme.Colors.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: Theme.Colors.textSecondary },
  modalConfirm: { flex: 1, backgroundColor: Theme.Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
