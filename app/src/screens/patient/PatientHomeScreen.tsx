/**
 * Patient Home Screen — Beeline-style home with bold cards.
 */

import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import Theme from '../../theme';

export default function PatientHomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const cards = [
    {
      title: 'Book a doctor',
      subtitle: 'Choose a specialist and schedule a video visit.',
      icon: '🩺',
      accentColor: Theme.Colors.accentBlue,
      onPress: () => {},
    },
    {
      title: 'Upload lab results',
      subtitle: "Let AI highlight what's important before your doctor reviews.",
      icon: '📋',
      accentColor: Theme.Colors.accentTeal,
      onPress: () => navigation.navigate('LabUpload'),
    },
    {
      title: 'AI health assistant',
      subtitle: 'Ask questions about your results and care plan.',
      icon: '🤖',
      accentColor: Theme.Colors.primary,
      onPress: () => navigation.navigate('AIAssistant'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hi {user?.name || 'there'},</Text>
          <Text style={styles.subtitle}>
            manage your care, labs and consultations in one place.
          </Text>
        </View>

        {/* Main cards */}
        <View style={styles.cardsContainer}>
          {cards.map((card, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              onPress={card.onPress}
              activeOpacity={0.9}
            >
              <View style={[styles.cardAccent, { backgroundColor: card.accentColor }]} />
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>{card.icon}</Text>
                  <Text style={[styles.cardArrow, { color: card.accentColor }]}>→</Text>
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        <TouchableOpacity
          style={styles.activityCard}
          onPress={() => navigation.navigate('LabResultDetail', { resultId: 'recent' })}
          activeOpacity={0.9}
        >
          <View style={styles.activityContent}>
            <Text style={styles.activityIcon}>📄</Text>
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>CBC Results — Sep 14</Text>
              <Text style={styles.activitySubtitle}>AI analysis ready</Text>
            </View>
            <Text style={styles.activityArrow}>→</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => {}}>
          <Text style={[styles.tabText, styles.tabActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => navigation.navigate('LabResultsList')}>
          <Text style={styles.tabText}>Labs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={() => {}}>
          <Text style={styles.tabText}>Profile</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    marginBottom: Theme.Spacing.xxl,
  },
  greeting: {
    fontSize: Theme.Typography.title,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
  },
  subtitle: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.textSecondary,
    lineHeight: Theme.Typography.lineHeightBody,
    marginTop: Theme.Spacing.xs,
  },
  cardsContainer: {
    gap: Theme.Spacing.md,
  },
  card: {
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.xl,
    overflow: 'hidden',
    ...Theme.Shadows.medium,
  },
  cardAccent: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: Theme.Spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.Spacing.sm,
  },
  cardIcon: {
    fontSize: 32,
  },
  cardArrow: {
    fontSize: 24,
    fontWeight: Theme.Typography.bold,
  },
  cardTitle: {
    fontSize: Theme.Typography.subheading,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: Theme.Typography.bodySmall,
    color: Theme.Colors.textSecondary,
    lineHeight: Theme.Typography.lineHeightCaption,
    marginTop: Theme.Spacing.xs,
  },
  sectionHeader: {
    marginTop: Theme.Spacing.xxxl,
    marginBottom: Theme.Spacing.md,
  },
  sectionTitle: {
    fontSize: Theme.Typography.heading,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
  },
  activityCard: {
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.lg,
    padding: Theme.Spacing.lg,
    ...Theme.Shadows.small,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    fontSize: 24,
    marginRight: Theme.Spacing.md,
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: Theme.Typography.body,
    fontWeight: Theme.Typography.semibold,
    color: Theme.Colors.textPrimary,
  },
  activitySubtitle: {
    fontSize: Theme.Typography.caption,
    color: Theme.Colors.accentTeal,
    marginTop: 2,
  },
  activityArrow: {
    fontSize: 20,
    color: Theme.Colors.textMuted,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Theme.Colors.surface,
    paddingVertical: Theme.Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Theme.Colors.borderLight,
    ...Theme.Shadows.large,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.Spacing.sm,
  },
  tabText: {
    fontSize: Theme.Typography.bodySmall,
    color: Theme.Colors.textMuted,
    fontWeight: Theme.Typography.medium,
  },
  tabActive: {
    color: Theme.Colors.primary,
    fontWeight: Theme.Typography.bold,
  },
});
