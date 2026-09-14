import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-6">Privacy Policy</h1>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Effective Date:</strong> September 14, 2026</p>
          <p>Medic1905 (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal and health-related data.</p>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">1. Data We Collect</h2>
            <p>We collect the following types of data:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Account information (name, email, role)</li>
              <li>Lab results and medical documents you upload</li>
              <li>Appointment details and consultation history</li>
              <li>Usage data (IP address, device information, activity logs)</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">2. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To provide telemedicine services and connect you with doctors</li>
              <li>To generate AI-powered lab result analyses</li>
              <li>To manage appointments and prescriptions</li>
              <li>To comply with legal and regulatory requirements</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Data Storage & Security</h2>
            <p>Your data is stored in encrypted databases using Neon Postgres with SSL/TLS connections. We use industry-standard encryption (AES-256 at rest, TLS in transit). Access is restricted to authorized personnel only.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">4. GDPR Compliance</h2>
            <p>Under the General Data Protection Regulation (GDPR), you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Access your personal data</li>
              <li>Request data rectification or erasure</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">5. Contact</h2>
            <p>For privacy inquiries, contact us at: privacy@medic1905.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
