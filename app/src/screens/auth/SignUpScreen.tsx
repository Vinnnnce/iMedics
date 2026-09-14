/**
 * SignUp Screen — Full registration form with role selection.
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

const ROLES = [
  { value: 'PATIENT', label: 'Patient', icon: '🧑', desc: 'Book consults, upload labs, get AI insights' },
  { value: 'DOCTOR', label: 'Doctor', icon: '🩺', desc: 'Review patients, lab results, prescribe' },
  { value: 'LAB_SCIENTIST', label: 'Lab Scientist', icon: '🔬', desc: 'Verify results, manage lab orders' },
];

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp({ email, password, role, name });
    } catch (e: any) {
      setError(e.message || 'Sign up failed. Please try again.');
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

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join Medic1905 to manage your care</Text>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Role selection */}
        <Text style={styles.sectionLabel}>I am a...</Text>
        <View style={styles.roleContainer}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleCard, role === r.value && styles.roleCardActive]}
            >
              <Text style={styles.roleIcon} onPress={() => setRole(r.value)}>{r.icon}</Text>
              <View style={styles.roleInfo}>
                <Text
                  style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}
                  onPress={() => setRole(r.value)}
                >
                  {r.label}
                </Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
              </View>
              <View style={[styles.radioButton, role === r.value && styles.radioButtonActive]}>
                {role === r.value && <View style={styles.radioButtonInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={Theme.Colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

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
              placeholder="Min 8 characters"
              placeholderTextColor={Theme.Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signUpButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign in link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity>
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignIn')}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          By signing up, you agree that Medic1905 is a platform only. AI-generated content is informational and not medical advice. Doctors remain responsible for clinical decisions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 40 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.Spacing.xxl, marginTop: Theme.Spacing.xl },
  logoIcon: { width: 40, height: 40, borderRadius: Theme.BorderRadius.md, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Theme.Spacing.sm },
  logoCross: { fontSize: 24, color: '#fff', fontWeight: '700' },
  logoText: { fontSize: 22, fontWeight: '700', color: Theme.Colors.primary },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.xs },
  subtitle: { fontSize: Theme.Typography.body, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xxl },
  errorBanner: { backgroundColor: Theme.Colors.lowBg, borderRadius: Theme.BorderRadius.md, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.lg, borderLeftWidth: 4, borderLeftColor: Theme.Colors.low },
  errorText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.low },
  sectionLabel: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm },
  roleContainer: { marginBottom: Theme.Spacing.xxl, gap: Theme.Spacing.sm },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg, borderWidth: 2, borderColor: 'transparent', ...Theme.Shadows.small },
  roleCardActive: { borderColor: Theme.Colors.primary, backgroundColor: Theme.Colors.surfaceTint },
  roleIcon: { fontSize: 28, marginRight: Theme.Spacing.md },
  roleInfo: { flex: 1 },
  roleLabel: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  roleLabelActive: { color: Theme.Colors.primary },
  roleDesc: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, marginTop: 2 },
  radioButton: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Theme.Colors.border, justifyContent: 'center', alignItems: 'center' },
  radioButtonActive: { borderColor: Theme.Colors.primary },
  radioButtonInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Theme.Colors.primary },
  form: { marginBottom: Theme.Spacing.xl },
  inputGroup: { marginBottom: Theme.Spacing.lg },
  label: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.sm },
  input: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.lg, fontSize: Theme.Typography.body, color: Theme.Colors.textPrimary, borderWidth: 1, borderColor: Theme.Colors.border },
  signUpButton: { backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', marginTop: Theme.Spacing.sm, ...Theme.Shadows.medium },
  signUpButtonText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: Theme.Colors.textInverse },
  footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: Theme.Spacing.xl },
  footerText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary },
  footerLink: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.bold, color: Theme.Colors.primary },
  disclaimer: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, textAlign: 'center', lineHeight: Theme.Typography.lineHeightCaption },
});
