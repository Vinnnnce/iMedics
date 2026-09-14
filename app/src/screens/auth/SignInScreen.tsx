/**
 * SignIn Screen — Full auth form with email/password.
 * Dark neon theme matching Medic1905 brand.
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import Theme from '../../theme';

export default function SignInScreen() {
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoCross}>+</Text>
          </View>
          <Text style={styles.logoText}>Medic1905</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to manage your care</Text>

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Theme.Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={Theme.Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.signInButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInButtonText} onPress={handleSignIn}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity>
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignUp')}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Medic1905 is a platform only, not a medical provider. AI-generated content is informational and not a substitute for professional medical advice.
        </Text>
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
    paddingBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.Spacing.xxxl,
    marginTop: Theme.Spacing.xl,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.BorderRadius.md,
    backgroundColor: Theme.Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.Spacing.sm,
  },
  logoCross: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.Colors.primary,
  },
  title: {
    fontSize: Theme.Typography.title,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textPrimary,
    marginBottom: Theme.Spacing.xs,
  },
  subtitle: {
    fontSize: Theme.Typography.body,
    color: Theme.Colors.textSecondary,
    marginBottom: Theme.Spacing.xxl,
  },
  errorBanner: {
    backgroundColor: Theme.Colors.lowBg,
    borderRadius: Theme.BorderRadius.md,
    padding: Theme.Spacing.lg,
    marginBottom: Theme.Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Theme.Colors.low,
  },
  errorText: {
    fontSize: Theme.Typography.bodySmall,
    color: Theme.Colors.low,
  },
  form: {
    marginBottom: Theme.Spacing.xl,
  },
  inputGroup: {
    marginBottom: Theme.Spacing.lg,
  },
  label: {
    fontSize: Theme.Typography.bodySmall,
    fontWeight: Theme.Typography.semibold,
    color: Theme.Colors.textPrimary,
    marginBottom: Theme.Spacing.sm,
  },
  input: {
    backgroundColor: Theme.Colors.surface,
    borderRadius: Theme.BorderRadius.md,
    paddingHorizontal: Theme.Spacing.lg,
    paddingVertical: Theme.Spacing.lg,
    fontSize: Theme.Typography.body,
    color: Theme.Colors.textPrimary,
    borderWidth: 1,
    borderColor: Theme.Colors.border,
  },
  signInButton: {
    backgroundColor: Theme.Colors.primary,
    borderRadius: Theme.BorderRadius.md,
    paddingVertical: Theme.Spacing.lg,
    alignItems: 'center',
    marginTop: Theme.Spacing.sm,
    ...Theme.Shadows.medium,
  },
  signInButtonText: {
    fontSize: Theme.Typography.body,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.textInverse,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Theme.Spacing.xl,
  },
  footerText: {
    fontSize: Theme.Typography.bodySmall,
    color: Theme.Colors.textSecondary,
  },
  footerLink: {
    fontSize: Theme.Typography.bodySmall,
    fontWeight: Theme.Typography.bold,
    color: Theme.Colors.primary,
  },
  disclaimer: {
    fontSize: Theme.Typography.caption,
    color: Theme.Colors.textMuted,
    textAlign: 'center',
    lineHeight: Theme.Typography.lineHeightCaption,
  },
});
