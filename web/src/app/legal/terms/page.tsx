import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-2">Terms of Use</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: September 16, 2026</p>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Scope and Acceptance</h2>
            <p>These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of the Medic1905 platform (&ldquo;the Service&rdquo;), operated by Medic1905 GmbH (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;the Company&rdquo;). By creating an account, accessing, or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use the Service.</p>
            <p>These Terms apply to all users, including patients, doctors, laboratory scientists, and administrators.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Nature of the Service</h2>
            <p>Medic1905 is a <strong className="text-foreground">platform only</strong> and is not a medical provider. The Service facilitates communication between patients and licensed healthcare professionals, manages laboratory orders and results, and provides AI-generated explanations of lab values. Medic1905 does not:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide medical advice, diagnosis, or treatment directly</li>
              <li>Employ or contract with doctors or lab scientists as healthcare providers</li>
              <li>Guarantee the accuracy, completeness, or timeliness of any medical information on the platform</li>
              <li>Accept responsibility for clinical decisions made by healthcare professionals using the platform</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. AI-Generated Content Disclaimer</h2>
            <p>The Service uses Kimi K3 artificial intelligence to generate explanations of laboratory results. All AI-generated content is <strong className="text-foreground">informational only</strong> and must not be considered:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>A medical diagnosis or clinical assessment</li>
              <li>A recommendation for treatment, medication, or lifestyle change</li>
              <li>A substitute for professional medical advice, examination, diagnosis, or treatment</li>
              <li>A replacement for the professional judgment of a licensed healthcare provider</li>
            </ul>
            <p>Always seek the advice of a qualified healthcare professional with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read on Medic1905.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. User Obligations</h2>
            <p>All users agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide accurate, complete, and current information</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not use the Service for emergency medical situations (call your local emergency number instead)</li>
              <li>Maintain the confidentiality of their account credentials</li>
              <li>Not attempt to access unauthorized areas of the platform</li>
              <li>Not upload malicious files, viruses, or harmful code</li>
              <li>Respect the privacy and rights of other users</li>
              <li>Not use the Service to harass, abuse, or harm others</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Professional Obligations</h2>
            <p>Doctors and laboratory scientists using the Service acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>They remain fully responsible for all clinical decisions and professional judgments</li>
              <li>They must practice within the scope of their license and professional qualifications</li>
              <li>AI-generated summaries are informational aids and must not replace their own clinical assessment</li>
              <li>They must verify the accuracy of lab results before relying on them for patient care</li>
              <li>They must comply with all applicable healthcare regulations, professional codes of conduct, and data protection laws</li>
              <li>Their use of the Service does not create an employment or agency relationship with Medic1905</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied</li>
              <li>Medic1905 is not liable for any medical decisions made based on AI-generated content</li>
              <li>Medic1905 is not liable for the actions, omissions, or clinical decisions of healthcare professionals using the platform</li>
              <li>Medic1905 is not liable for indirect, incidental, special, or consequential damages</li>
              <li>Medic1905&rsquo;s total liability shall not exceed the amount paid by the user in the preceding 12 months</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Modification and Termination</h2>
            <p>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or platform notification at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the modified Terms.</p>
            <p>We may suspend or terminate your account at any time for violations of these Terms, fraudulent activity, or when required by law. You may delete your account at any time through the profile settings.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Governing Law and Dispute Resolution</h2>
            <p>These Terms are governed by the laws of the Federal Republic of Germany. Any disputes arising from or relating to these Terms or the Service shall be resolved through the following process:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>First, the parties shall attempt to resolve the dispute through good-faith negotiations within 30 days</li>
              <li>If unresolved, the dispute shall be submitted to mediation before the Frankfurt am Main Mediation Center</li>
              <li>If mediation fails, the dispute shall be resolved by the competent courts of Frankfurt am Main, Germany</li>
            </ul>
          </section>

          <div className="rounded-lg border border-border p-4 bg-muted/20">
            <p className="text-xs"><strong className="text-foreground">Note:</strong> These Terms of Use are a template and should be reviewed by a qualified legal professional before deployment. They may need to be adapted to comply with specific jurisdictional requirements and healthcare regulations.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
