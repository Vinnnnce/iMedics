import { Card, CardContent } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-6">Terms of Use</h1>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Effective Date:</strong> September 14, 2026</p>
          <p>By using Medic1905, you agree to these Terms of Use. Medic1905 is a platform only, not a medical provider.</p>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">1. Medical Disclaimer</h2>
            <p>Medic1905 facilitates communication between patients and licensed healthcare professionals. The platform does not provide medical advice, diagnosis, or treatment directly. All AI-generated content is informational only and should not replace professional medical consultation.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">2. User Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Provide accurate and complete information</li>
              <li>Do not use the platform for emergency medical situations</li>
              <li>Respect the privacy of other users</li>
              <li>Do not attempt to access unauthorized areas</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Limitation of Liability</h2>
            <p>Medic1905 is provided &quot;as is&quot; without warranties. We are not liable for any medical decisions made based on AI-generated content. Doctors remain fully responsible for clinical decisions.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">4. Acceptable Use</h2>
            <p>Users must not upload malicious files, attempt to reverse-engineer the platform, or use automated tools to scrape data without authorization.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
