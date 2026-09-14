import { Card, CardContent } from "@/components/ui/card";

export default function CookiesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-6">Cookies Policy</h1>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">
          <p><strong className="text-foreground">Effective Date:</strong> September 14, 2026</p>
          <p>Medic1905 uses cookies to enhance your browsing experience. Cookies are small text files stored on your device.</p>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">1. Types of Cookies We Use</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Essential cookies:</strong> Required for the platform to function (authentication, session management)</li>
              <li><strong className="text-foreground">Functional cookies:</strong> Remember your preferences (theme, language)</li>
              <li><strong className="text-foreground">Analytics cookies:</strong> Help us understand how you use the platform (anonymized)</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">2. Managing Cookies</h2>
            <p>You can control and delete cookies through your browser settings. Disabling essential cookies may affect platform functionality.</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Third-Party Cookies</h2>
            <p>We may use third-party services (e.g., analytics) that set their own cookies. These are governed by their respective privacy policies.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
