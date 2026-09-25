/**
 * ProfileSettings Screen — Tabs for profile info, security, notifications, preferences.
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
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import Theme from '../../theme';

const TABS = [
  { value: 'profile', label: 'Profile', icon: '👤' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'notifications', label: 'Notifications', icon: '🔔' },
  { value: 'preferences', label: 'Preferences', icon: '⚙️' },
];

export default function ProfileSettingsScreen() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [email] = useState(user?.email || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState('');
  const [language, setLanguage] = useState('en');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifSms, setNotifSms] = useState(false);
  const [prefDarkMode, setPrefDarkMode] = useState(true);
  const [prefLanguage, setPrefLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, activeTab === tab.value && styles.tabActive]}
            onPress={() => setActiveTab(tab.value)}
          >
            <Text style={[styles.tabIcon, activeTab === tab.value && styles.tabIconActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.value && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile tab */}
        {activeTab === 'profile' && (
          <View style={styles.tabContent}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user?.role}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={Theme.Colors.textMuted} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+49..." placeholderTextColor={Theme.Colors.textMuted} keyboardType="phone-pad" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor={Theme.Colors.textMuted} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sex</Text>
              <View style={styles.chipRow}>
                {['male', 'female', 'other'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, sex === s && styles.chipActive]}
                    onPress={() => setSex(s)}
                  >
                    <Text style={[styles.chipText, sex === s && styles.chipTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Security tab */}
        {activeTab === 'security' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={Theme.Colors.textMuted} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Min 8 characters" placeholderTextColor={Theme.Colors.textMuted} />
            </View>

            <Text style={styles.sectionTitle}>Security Settings</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
              <Switch value={false} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Biometric Login</Text>
              <Switch value={false} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications tab */}
        {activeTab === 'notifications' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Notification Channels</Text>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDesc}>Lab results, appointments, AI alerts</Text>
              </View>
              <Switch value={notifEmail} onValueChange={setNotifEmail} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Real-time alerts on your device</Text>
              </View>
              <Switch value={notifPush} onValueChange={setNotifPush} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>SMS Notifications</Text>
                <Text style={styles.settingDesc}>Critical alerts only</Text>
              </View>
              <Switch value={notifSms} onValueChange={setNotifSms} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>
          </View>
        )}

        {/* Preferences tab */}
        {activeTab === 'preferences' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Switch value={prefDarkMode} onValueChange={setPrefDarkMode} trackColor={{ false: Theme.Colors.border, true: Theme.Colors.primary }} thumbColor="#fff" />
            </View>

            <Text style={styles.sectionTitle}>Language</Text>
            <View style={styles.chipRow}>
              {[
                { code: 'en', label: 'English' },
                { code: 'fr', label: 'Français' },
                { code: 'ru', label: 'Русский' },
                { code: 'es', label: 'Español' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.chip, prefLanguage === lang.code && styles.chipActive]}
                  onPress={() => setPrefLanguage(lang.code)}
                >
                  <Text style={[styles.chipText, prefLanguage === lang.code && styles.chipTextActive]}>{lang.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Data & Privacy</Text>
            <TouchableOpacity style={styles.dataButton}>
              <Text style={styles.dataButtonText}>Download My Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dataButton, styles.dataButtonDanger]}>
              <Text style={[styles.dataButtonText, styles.dataButtonTextDanger]}>Delete My Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save button */}
        {activeTab !== 'security' && activeTab !== 'notifications' && activeTab !== 'preferences' && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Medic1905 is a platform only, not a medical provider. Your data is processed in accordance with our Privacy Policy and GDPR.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: Theme.Colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.Colors.borderLight },
  tab: { flex: 1, paddingVertical: Theme.Spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: Theme.Colors.primary },
  tabIcon: { fontSize: 18, marginBottom: 4 },
  tabIconActive: {},
  tabLabel: { fontSize: 11, color: Theme.Colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: Theme.Colors.primary, fontWeight: '700' },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  tabContent: { marginBottom: Theme.Spacing.xl },
  avatarSection: { alignItems: 'center', marginBottom: Theme.Spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Theme.Spacing.md },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  profileEmail: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, marginTop: 2 },
  roleBadge: { backgroundColor: Theme.Colors.surfaceTint, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.md, paddingVertical: Theme.Spacing.xs, marginTop: Theme.Spacing.sm },
  roleText: { fontSize: 10, fontWeight: '700', color: Theme.Colors.primary },
  sectionTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.md, marginTop: Theme.Spacing.xl },
  inputGroup: { marginBottom: Theme.Spacing.lg },
  label: { fontSize: Theme.Typography.caption, fontWeight: Theme.Typography.medium, color: Theme.Colors.textSecondary, marginBottom: Theme.Spacing.xs },
  input: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.md, fontSize: Theme.Typography.body, color: Theme.Colors.textPrimary, borderWidth: 1, borderColor: Theme.Colors.border },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.Spacing.sm },
  chip: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.sm, borderWidth: 1, borderColor: Theme.Colors.border },
  chipActive: { backgroundColor: Theme.Colors.primary, borderColor: Theme.Colors.primary },
  chipText: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, padding: Theme.Spacing.lg, marginBottom: Theme.Spacing.sm, ...Theme.Shadows.small },
  settingLabel: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.textPrimary },
  settingDesc: { fontSize: 11, color: Theme.Colors.textMuted, marginTop: 2 },
  signOutButton: { backgroundColor: Theme.Colors.lowBg, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', marginTop: Theme.Spacing.xl },
  signOutText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: Theme.Colors.low },
  saveButton: { backgroundColor: Theme.Colors.primary, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', marginBottom: Theme.Spacing.lg, ...Theme.Shadows.medium },
  saveButtonText: { fontSize: Theme.Typography.body, fontWeight: Theme.Typography.bold, color: '#fff' },
  dataButton: { backgroundColor: Theme.Colors.surface, borderRadius: Theme.BorderRadius.md, paddingVertical: Theme.Spacing.lg, alignItems: 'center', marginBottom: Theme.Spacing.sm, borderWidth: 1, borderColor: Theme.Colors.border },
  dataButtonText: { fontSize: Theme.Typography.bodySmall, fontWeight: Theme.Typography.semibold, color: Theme.Colors.primary },
  dataButtonDanger: { borderColor: Theme.Colors.low },
  dataButtonTextDanger: { color: Theme.Colors.low },
  disclaimer: { fontSize: Theme.Typography.caption, color: Theme.Colors.textMuted, textAlign: 'center', lineHeight: Theme.Typography.lineHeightCaption, marginTop: Theme.Spacing.lg },
});
