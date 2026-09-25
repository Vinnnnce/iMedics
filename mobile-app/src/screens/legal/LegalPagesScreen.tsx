/**
 * LegalPages Screen — Privacy Policy, Terms of Use, Cookies Policy.
 * Accessible from Profile/Settings or footer links.
 */

import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Theme from '../../theme';

type PolicyType = 'privacy' | 'terms' | 'cookies';

const PRIVACY_POLICY = `PRIVACY POLICY — MEDIC1905

Last updated: September 14, 2026

1. INTRODUCTION

Medic1905 ("we", "us", or "our") operates a telemedicine platform that connects patients, doctors, and laboratory scientists. We are committed to protecting your personal data and respecting your privacy rights under the General Data Protection Regulation (GDPR) and other applicable data protection laws.

This Privacy Policy explains how we collect, use, share, and protect your personal and health data when you use our platform.

2. DATA WE COLLECT

2.1 Identification Data
- Full name, email address, phone number
- Date of birth, sex
- Account credentials (encrypted passwords)

2.2 Medical Data (Special Category)
- Laboratory test results and values
- Medical conditions and medications
- Insurance information
- Uploaded medical documents (PDFs, images)
- AI-generated health summaries

2.3 Technical Data
- IP address, device information
- Browser type and version
- Usage logs and audit trails
- Cookies and similar technologies

3. PURPOSES OF PROCESSING

3.1 Providing the Service (Legal Basis: Contract)
- Account creation and authentication
- Appointment booking and management
- Lab result storage and AI analysis
- Video consultations

3.2 Legal Compliance (Legal Basis: Legal Obligation)
- Maintaining audit logs for healthcare regulations
- Responding to lawful requests from authorities
- Complying with medical record retention requirements

3.3 Platform Improvement (Legal Basis: Legitimate Interests)
- Analytics and performance monitoring
- Feature development and testing
- AI model improvement (anonymized data only)

3.4 Marketing (Legal Basis: Consent)
- Service notifications (appointments, results)
- Optional newsletters and updates

4. DATA SHARING

4.1 Healthcare Professionals
- Your designated doctors can access your medical data for consultation purposes
- Lab scientists can access results they are assigned to verify

4.2 Service Providers
- Cloud hosting providers (Neon, Vercel)
- AI service providers (Kimi K3 / Moonshot AI) for lab result analysis
- Storage providers for medical files (S3-compatible)

4.3 Legal Authorities
- When required by law or court order
- To protect the rights, safety, or property of users

5. INTERNATIONAL TRANSFERS

Your data is stored in the European Union (Frankfurt region) wherever possible. Where data is processed outside the EU (e.g., AI services), we ensure appropriate safeguards are in place, including Standard Contractual Clauses or adequacy decisions.

6. DATA RETENTION

- Active account data: Retained while your account is active
- Medical records: Retained for the period required by applicable law (typically 10 years)
- Audit logs: Retained for 7 years
- Inactive accounts: Deleted after 24 months of inactivity, unless legal retention applies

7. YOUR RIGHTS

Under GDPR, you have the following rights:
- Right of Access: Request a copy of your personal data
- Right to Rectification: Correct inaccurate or incomplete data
- Right to Erasure: Request deletion of your data ("right to be forgotten")
- Right to Restriction: Limit how we process your data
- Right to Object: Object to processing based on legitimate interests
- Right to Data Portability: Receive your data in a structured, machine-readable format
- Right to Withdraw Consent: Withdraw consent for consent-based processing at any time

To exercise these rights, contact us at: privacy@medic1905.com

8. SECURITY MEASURES

- Encryption at rest (database-level encryption)
- Encryption in transit (TLS 1.3 / HTTPS)
- Role-based access control (RBAC)
- Audit logging of all PHI access
- Regular security audits and penetration testing
- Multi-factor authentication for healthcare professionals

9. CONTACT

Data Protection Officer: dpo@medic1905.com
General inquiries: support@medic1905.com

This policy may be updated periodically. Material changes will be notified via email.`;

const TERMS_OF_USE = `TERMS OF USE — MEDIC1905

Last updated: September 14, 2026

1. SCOPE AND ACCEPTANCE

These Terms of Use ("Terms") govern your use of the Medic1905 platform ("Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

2. NATURE OF THE SERVICE

2.1 Platform Only
Medic1905 is a technology platform that connects patients, doctors, and laboratory scientists. Medic1905 is NOT a medical provider, hospital, clinic, or healthcare facility.

2.2 No Doctor-Patient Relationship
The Service does not create a doctor-patient relationship between you and Medic1905. Any clinical relationship is solely between you and the healthcare professional you consult through the platform.

2.3 Not Emergency Services
Medic1905 is NOT an emergency service. If you have a medical emergency, call your local emergency number (e.g., 112 in the EU) immediately.

3. AI-GENERATED CONTENT DISCLAIMER

3.1 Informational Only
AI-generated explanations of lab results are provided by Kimi K3 (Moonshot AI). These explanations are INFORMATIONAL ONLY and do NOT constitute:
- A medical diagnosis
- Treatment recommendations
- Prescription advice
- Medical advice of any kind

3.2 No Reliance
You should NOT rely on AI-generated content for medical decisions. Always consult a qualified healthcare professional before making any health-related decisions.

3.3 Accuracy Limitations
While we strive for accuracy, AI-generated content may contain errors or omissions. AI explanations should be reviewed by a healthcare professional.

4. USER OBLIGATIONS

4.1 Accurate Information
You agree to provide accurate, complete, and current information, including:
- True identity and contact information
- Accate medical history and laboratory results
- Correct role designation (patient, doctor, or lab scientist)

4.2 Lawful Use
You agree not to:
- Use the Service for any illegal purpose
- Upload false or misleading medical data
- Attempt to access another user's data without authorization
- Reverse engineer or disrupt the Service
- Share your account credentials

4.3 Credential Security
You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account.

5. PROFESSIONAL OBLIGATIONS

5.1 Doctors
Doctors using the platform remain solely responsible for:
- Clinical decisions and diagnoses
- Treatment plans and prescriptions
- Reviewing and validating AI-generated content
- Maintaining professional liability insurance
- Complying with their professional licensing requirements

5.2 Lab Scientists
Lab scientists are responsible for:
- Verifying accuracy of laboratory results
- Reviewing AI-flagged values for clinical plausibility
- Maintaining quality control standards

6. LIMITATION OF LIABILITY

6.1 To the maximum extent permitted by law, Medic1905 shall NOT be liable for:
- Any indirect, incidental, or consequential damages
- Medical decisions made based on AI-generated content
- Inaccuracies in laboratory results or AI explanations
- Service interruptions or technical failures
- Unauthorized access to your data by third parties

6.2 Total liability shall not exceed the fees paid by you in the preceding 12 months.

7. MODIFICATION AND TERMINATION

7.1 We may modify these Terms at any time. Material changes will be notified 30 days in advance.

7.2 We may suspend or terminate your account for violations of these Terms.

7.3 You may delete your account at any time through the Profile Settings.

8. GOVERNING LAW AND DISPUTE RESOLUTION

8.1 These Terms are governed by the laws of the Federal Republic of Germany.

8.2 Disputes shall be resolved through:
1. Good-faith negotiation (14 days)
2. Mediation (if unresolved)
3. Competent courts of Frankfurt am Main, Germany

9. CONTACT

Legal inquiries: legal@medic1905.com
Support: support@medic1905.com`;

const COOKIES_POLICY = `COOKIES POLICY — MEDIC1905

Last updated: September 14, 2026

1. WHAT ARE COOKIES?

Cookies are small text files stored on your device when you visit a website or use a web application. They help us remember your preferences, maintain your session, and analyze how you use our platform.

2. TYPES OF COOKIES WE USE

2.1 Strictly Necessary Cookies
These cookies are essential for the Service to function. They enable:
- User authentication and session management
- Security features (CSRF protection)
- Load balancing

These cookies cannot be disabled as they are required for the Service to operate.

2.2 Preference Cookies
These cookies remember your choices and preferences:
- Language selection
- Theme preferences (dark/light mode)
- Notification settings

2.3 Analytics Cookies
These cookies help us understand how you use the platform:
- Page views and navigation patterns
- Feature usage statistics
- Error tracking and performance monitoring

3. PURPOSES OF COOKIES

- Authentication: Maintaining your login session
- Security: Preventing fraud and unauthorized access
- User Experience: Remembering preferences
- Analytics: Improving the platform based on usage data
- Compliance: Maintaining audit trails where required

4. MANAGING COOKIES

4.1 Browser Settings
You can control cookies through your browser settings:
- Chrome: Settings > Privacy and Security > Cookies
- Safari: Preferences > Privacy > Cookies
- Firefox: Options > Privacy & Security > Cookies

4.2 In-App Settings
You can manage notification and preference cookies through the Profile > Preferences section of the app.

4.3 Disabling Cookies
Disabling strictly necessary cookies will prevent the Service from functioning properly. You may lose access to certain features.

5. THIRD-PARTY COOKIES

We use the following third-party services that may set cookies:
- Neon (database hosting) — no cookies
- Vercel (web hosting) — analytics cookies
- Kimi K3 / Moonshot AI (AI service) — no cookies

We do not sell or share cookie data with advertising networks.

6. UPDATES

This Cookies Policy may be updated periodically. Material changes will be notified through the platform or via email.

7. CONTACT

Questions about cookies: privacy@medic1905.com`;

export default function LegalPagesScreen() {
  const [activePolicy, setActivePolicy] = useState<PolicyType>('privacy');

  const policies: Record<PolicyType, { title: string; content: string }> = {
    privacy: { title: 'Privacy Policy', content: PRIVACY_POLICY },
    terms: { title: 'Terms of Use', content: TERMS_OF_USE },
    cookies: { title: 'Cookies Policy', content: COOKIES_POLICY },
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Policy tabs */}
      <View style={styles.tabBar}>
        {(Object.keys(policies) as PolicyType[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activePolicy === key && styles.tabActive]}
            onPress={() => setActivePolicy(key)}
          >
            <Text style={[styles.tabText, activePolicy === key && styles.tabTextActive]}>
              {policies[key].title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{policies[activePolicy].title}</Text>
        <Text style={styles.content}>{policies[activePolicy].content}</Text>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            These legal documents are templates provided for informational purposes. They are not a substitute for professional legal advice. Please consult a qualified attorney before deploying in a production environment.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: Theme.Colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.Colors.borderLight },
  tab: { flex: 1, paddingVertical: Theme.Spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: Theme.Colors.primary },
  tabText: { fontSize: 12, color: Theme.Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Theme.Colors.primary, fontWeight: '700' },
  scrollContent: { padding: Theme.Spacing.xl, paddingBottom: 80 },
  title: { fontSize: Theme.Typography.title, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary, marginBottom: Theme.Spacing.lg },
  content: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textSecondary, lineHeight: 22 },
  disclaimerBox: { backgroundColor: Theme.Colors.warningBg, borderRadius: Theme.BorderRadius.md, padding: Theme.Spacing.lg, marginTop: Theme.Spacing.xl, borderLeftWidth: 4, borderLeftColor: Theme.Colors.warning },
  disclaimerText: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary, lineHeight: 18 },
});
