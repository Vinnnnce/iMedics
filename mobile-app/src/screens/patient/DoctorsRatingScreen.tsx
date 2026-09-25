/**
 * DoctorsRating Screen — Rate doctors with stars and reviews.
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
} from 'react-native';
import Theme from '../../theme';

const DOCTORS = [
  { id: '1', name: 'Dr. Anna Schmidt', specialty: 'General Medicine', rating: 4.8, reviews: 124 },
  { id: '2', name: 'Dr. Boris Petrov', specialty: 'Cardiology', rating: 4.6, reviews: 89 },
  { id: '3', name: 'Dr. Clara Weiss', specialty: 'Endocrinology', rating: 4.9, reviews: 156 },
  { id: '4', name: 'Dr. Dmitry Volkov', specialty: 'Dermatology', rating: 4.5, reviews: 67 },
];

const REVIEWS = [
  { id: '1', doctor: 'Dr. Anna Schmidt', patient: 'Sarah M.', rating: 5, text: 'Very thorough and caring. Took time to explain everything.', date: '2026-09-10' },
  { id: '2', doctor: 'Dr. Anna Schmidt', patient: 'John D.', rating: 4, text: 'Good consultation, but had to wait a bit.', date: '2026-09-08' },
  { id: '3', doctor: 'Dr. Clara Weiss', patient: 'Maria K.', rating: 5, text: 'Excellent endocrinologist. Very knowledgeable.', date: '2026-09-05' },
];

export default function DoctorsRatingScreen() {
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const doctorReviews = REVIEWS.filter(r => selectedDoctor && r.doctor === DOCTORS.find(d => d.id === selectedDoctor)?.name);

  const handleSubmit = () => {
    if (!selectedDoctor || rating === 0) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSelectedDoctor(null);
      setRating(0);
      setReview('');
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Rate Your Doctor</Text>
        <Text style={styles.subtitle}>Share your experience to help other patients</Text>

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
            <View style={styles.doctorRatingBox}>
              <Text style={styles.ratingStar}>★ {doc.rating}</Text>
              <Text style={styles.reviewCount}>{doc.reviews} reviews</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Rating form */}
        {selectedDoctor && (
          <View style={styles.ratingForm}>
            <Text style={styles.formTitle}>Your Rating</Text>

            {/* Star rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text style={[styles.star, star <= rating && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Review text */}
            <Text style={styles.label}>Your Review (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Tell others about your experience..."
              placeholderTextColor={Theme.Colors.textMuted}
              value={review}
              onChangeText={setReview}
              multiline
              maxLength={500}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={rating === 0}
            >
              <Text style={styles.submitButtonText}>Submit Review</Text>
            </TouchableOpacity>

            {submitted && (
              <View style={styles.successBanner}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successText}>Review submitted. Thank you!</Text>
              </View>
            )}
          </View>
        )}

        {/* Recent reviews */}
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        {(selectedDoctor ? doctorReviews : REVIEWS).map((rev) => (
          <View key={rev.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewAvatar}>
                <Text style={styles.reviewInitial}>{rev.patient.charAt(0)}</Text>
              </View>
              <View style={styles.reviewInfo}>
                <Text style={styles.reviewPatient}>{rev.patient}</Text>
                <Text style={styles.reviewDoctor}>{rev.doctor}</Text>
              </View>
              <View style={styles.reviewStars}>
                <Text style={styles.reviewStarText}>{'★'.repeat(rev.rating)}</Text>
                <Text style={styles.reviewDate}>{rev.date}</Text>
              </View>
            </View>
            <Text style={styles.reviewText}>{rev.text}</Text>
          </View>
        ))}

        {(selectedDoctor ? doctorReviews : REVIEWS).length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reviews yet for this doctor.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xs },
  subtitle: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xxl },
  label: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm },
  doctorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.sm, borderWidth: 2, borderColor: 'transparent', ...Theme.Shadows.small },
  doctorCardActive: { borderColor: Theme.Colors.primary, backgroundColor: Theme.Colors.surfaceTint },
  doctorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.md },
  doctorInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  doctorSpecialty: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  doctorRatingBox: { alignItems: 'flex-end' },
  ratingStar: { fontSize: 14, fontWeight: '700', color: Theme.Colors.accentAmber },
  reviewCount: { fontSize: 10, color: Theme.Colors.textMuted, marginTop: 2 },
  ratingForm: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginTop: Theme.Spacing.lg, marginBottom: Theme.Spacing.xxl, ...Theme.Shadows.small },
  formTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.md },
  starsContainer: { flexDirection: 'row', gap: Theme.Spacing.sm, marginBottom: Theme.Spacing.lg },
  star: { fontSize: 36, color: Theme.Colors.border },
  starActive: { color: Theme.Colors.accentAmber },
  reviewInput: { backgroundColor: Theme.Colors.background, borderRadius: Theme.BorderRadius.md, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.md, fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textPrimary, borderWidth: 1, borderColor: Theme.Colors.border, minHeight: 80, marginBottom: Theme.Spacing.lg },
  submitButton: { backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', ...Theme.Shadows.medium },
  submitButtonDisabled: { backgroundColor: Theme.Colors.border },
  submitButtonText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: '#fff' },
  successBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Theme.Colors.normalBg, borderRadius: Theme.BorderRadius.md, padding: Theme.Spacing.lg, marginTop: Theme.Spacing.md, gap: Theme.Spacing.sm },
  successIcon: { fontSize: 20, color: Theme.Colors.normal },
  successText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: Theme.Colors.normal },
  sectionTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.md },
  reviewCard: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.md, ...Theme.Shadows.small },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.Spacing.sm },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Theme.Colors.accentBlue, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.sm },
  reviewInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
  reviewInfo: { flex: 1 },
  reviewPatient: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  reviewDoctor: { fontSize: Theme.Typography.caption, color: Theme.Colors.primary, marginTop: 2 },
  reviewStars: { alignItems: 'flex-end' },
  reviewStarText: { fontSize: 12, color: Theme.Colors.accentAmber },
  reviewDate: { fontSize: 10, color: Theme.Colors.textMuted, marginTop: 2 },
  reviewText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textMuted },
});
