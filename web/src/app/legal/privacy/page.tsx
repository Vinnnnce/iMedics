import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-2">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: September 16, 2026</p>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Introduction</h2>
            <p>Medic1905 (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a telemedicine platform that connects patients, doctors, and laboratory scientists. We are committed to protecting the privacy and security of your personal and health-related data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>
            <p>By accessing or using Medic1905, you consent to the practices described in this Privacy Policy. If you do not agree with these practices, please do not use the platform.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Data We Collect</h2>
            <p>We collect the following categories of data:</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">2.1 Identification Data</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Full name, email address, phone number</li>
                  <li>Date of birth, sex, preferred language</li>
                  <li>Role (patient, doctor, lab scientist)</li>
                  <li>Insurance information (if voluntarily provided)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">2.2 Medical Data</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Lab results, test values, and reference ranges</li>
                  <li>Uploaded medical documents (PDF, images)</li>
                  <li>Appointment history and consultation notes</li>
                  <li>Prescriptions and treatment records</li>
                  <li>AI-generated lab result analyses</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">2.3 Technical Data</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>IP address, device type, browser information</li>
                  <li>Usage logs and activity records</li>
                  <li>Session cookies and authentication tokens</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Purposes of Processing</h2>
            <p>We process your personal data for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To provide telemedicine services and connect you with healthcare professionals</li>
              <li>To generate AI-powered lab result explanations using Kimi K3</li>
              <li>To manage appointments, prescriptions, and medical records</li>
              <li>To verify user identity and credentials (KYC for doctors and lab scientists)</li>
              <li>To comply with legal, regulatory, and healthcare standards</li>
              <li>To improve platform functionality, security, and user experience</li>
              <li>To send appointment reminders and important health notifications</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Legal Bases for Processing</h2>
            <p>We process your data based on the following legal grounds:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Contractual necessity:</strong> To provide the telemedicine services you requested</li>
              <li><strong className="text-foreground">Legal obligation:</strong> To comply with healthcare regulations and data protection laws</li>
              <li><strong className="text-foreground">Legitimate interests:</strong> To ensure platform security, prevent fraud, and improve services</li>
              <li><strong className="text-foreground">Consent:</strong> For optional features such as AI analysis, marketing communications, and analytics</li>
              <li><strong className="text-foreground">Vital interests:</strong> In rare cases where processing is necessary to protect a person&rsquo;s life or health</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Data Sharing</h2>
            <p>We do not sell your personal or medical data. We may share your information with:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Licensed healthcare professionals you choose to consult with via the platform</li>
              <li>Laboratory scientists processing your lab orders and results</li>
              <li>Service providers (e.g., cloud hosting, AI processing via Kimi K3) under strict data processing agreements</li>
              <li>Regulatory or law enforcement authorities when legally required</li>
              <li>Emergency services in life-threatening situations</li>
            </ul>
            <p>All third-party service providers are contractually bound to protect your data and use it only for the purposes we specify.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. International Data Transfers</h2>
            <p>Your data may be transferred to and processed in countries outside your jurisdiction, including the United States (for AI processing) and the European Union (for database hosting). We ensure that all international transfers comply with applicable data protection laws through Standard Contractual Clauses, adequacy decisions, or other lawful transfer mechanisms.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Data Retention</h2>
            <p>We retain your personal and medical data for as long as your account is active. After account deletion:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Medical records are retained for the period required by applicable healthcare regulations (typically 5&ndash;10 years)</li>
              <li>Audit logs are retained for 3 years for security and compliance purposes</li>
              <li>Technical data is deleted within 90 days of account closure</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Right of access:</strong> Request a copy of your personal data</li>
              <li><strong className="text-foreground">Right to rectification:</strong> Correct inaccurate or incomplete data</li>
              <li><strong className="text-foreground">Right to erasure:</strong> Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong className="text-foreground">Right to restriction:</strong> Limit how we process your data</li>
              <li><strong className="text-foreground">Right to object:</strong> Object to processing based on legitimate interests</li>
              <li><strong className="text-foreground">Right to data portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong className="text-foreground">Right to withdraw consent:</strong> Withdraw consent for processing based on consent at any time</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:privacy@medic1905.com" className="text-primary hover:underline">privacy@medic1905.com</a>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Security Measures</h2>
            <p>We implement industry-standard security measures to protect your data, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>End-to-end encryption for data in transit (TLS 1.3)</li>
              <li>Encryption at rest for stored medical records</li>
              <li>Role-based access control and multi-factor authentication</li>
              <li>Regular security audits and penetration testing</li>
              <li>Audit logging for all access to medical data</li>
              <li>Secure cloud infrastructure with SOC 2 and ISO 27001 certified providers</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Contact Details</h2>
            <p>If you have questions about this Privacy Policy or your personal data, please contact our Data Protection Officer:</p>
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-1">
              <p><strong className="text-foreground">Email:</strong> privacy@medic1905.com</p>
              <p><strong className="text-foreground">Phone:</strong> +49 69 1234 5678</p>
              <p><strong className="text-foreground">Address:</strong> Medic1905 GmbH, An der Hauptwache 15, 60311 Frankfurt am Main, Germany</p>
            </div>
          </section>

          <div className="rounded-lg border border-border p-4 bg-muted/20">
            <p className="text-xs"><strong className="text-foreground">Note:</strong> This Privacy Policy is a template and should be reviewed by a qualified legal professional before deployment in a production environment. It may need to be adapted to comply with specific jurisdictional requirements such as GDPR, HIPAA, or other healthcare data protection laws.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
