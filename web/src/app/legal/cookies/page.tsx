import { Card, CardContent } from "@/components/ui/card";

export default function CookiesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-primary neon-text mb-2">Cookies Policy</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: September 16, 2026</p>
      <Card className="bg-card border-border">
        <CardContent className="space-y-6 p-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. What Are Cookies?</h2>
            <p>Cookies are small text files that websites store on your device (computer, tablet, or smartphone) when you visit them. They allow the website to remember your actions and preferences over a period of time, so you don&rsquo;t have to re-enter them every time you visit the site or navigate from one page to another.</p>
            <p>Medic1905 uses cookies and similar technologies (such as local storage and session storage) to provide, secure, and improve our services.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Types of Cookies We Use</h2>
            <p>We use the following categories of cookies:</p>
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-4">
                <p className="font-medium text-foreground">Strictly Necessary Cookies</p>
                <p className="mt-1">These cookies are essential for the platform to function. They enable core functionality such as user authentication, session management, and security. Without these cookies, the Service cannot operate properly.</p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                  <li>Session authentication tokens</li>
                  <li>CSRF protection tokens</li>
                  <li>Security and fraud prevention cookies</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-medium text-foreground">Preference Cookies</p>
                <p className="mt-1">These cookies remember your preferences, such as language selection, theme (dark/light mode), and display settings. They enhance your experience but are not essential for the platform to function.</p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                  <li>Language preference</li>
                  <li>Theme preference (dark mode)</li>
                  <li>Accessibility settings</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="font-medium text-foreground">Analytics Cookies</p>
                <p className="mt-1">These cookies help us understand how visitors use our platform, which pages are most popular, and where visitors encounter issues. This data is anonymized and aggregated.</p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                  <li>Page view tracking</li>
                  <li>Session duration and bounce rate</li>
                  <li>Feature usage analytics</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Purposes of Cookies</h2>
            <p>We use cookies for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-foreground">Authentication:</strong> To keep you logged in and verify your identity across sessions</li>
              <li><strong className="text-foreground">Security:</strong> To protect against CSRF attacks, session hijacking, and unauthorized access</li>
              <li><strong className="text-foreground">Functionality:</strong> To remember your preferences and settings</li>
              <li><strong className="text-foreground">Analytics:</strong> To understand usage patterns and improve the platform</li>
              <li><strong className="text-foreground">Compliance:</strong> To maintain audit trails required by healthcare regulations</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Managing Cookies</h2>
            <p>You can control and manage cookies in several ways:</p>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">Browser Settings</p>
                <p className="mt-1">Most web browsers allow you to control cookies through their settings. You can usually:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
                  <li>Block all cookies</li>
                  <li>Allow only first-party cookies</li>
                  <li>Delete existing cookies</li>
                  <li>Set preferences for specific websites</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Platform Settings</p>
                <p className="mt-1">You can manage your cookie preferences directly in the Medic1905 settings page under Preferences. You can opt out of analytics cookies at any time.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Impact of Disabling Cookies</p>
                <p className="mt-1">Disabling strictly necessary cookies will prevent you from logging in, booking appointments, or using core platform features. Disabling analytics cookies will not affect platform functionality.</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Third-Party Cookies</h2>
            <p>We may use third-party services that set their own cookies, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Cloud hosting providers (for infrastructure and security)</li>
              <li>Analytics providers (for usage insights)</li>
              <li>Communication providers (for email and notifications)</li>
            </ul>
            <p>These third parties are governed by their respective privacy policies. We only work with providers that meet our data protection standards.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Updates to This Policy</h2>
            <p>We may update this Cookies Policy from time to time to reflect changes in technology, regulation, or our business practices. We will notify you of any material changes via email or platform notification. The date at the top of this page indicates when the policy was last updated.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Contact Us</h2>
            <p>If you have questions about our use of cookies, please contact us at <a href="mailto:privacy@medic1905.com" className="text-primary hover:underline">privacy@medic1905.com</a>.</p>
          </section>

          <div className="rounded-lg border border-border p-4 bg-muted/20">
            <p className="text-xs"><strong className="text-foreground">Note:</strong> This Cookies Policy is a template and should be reviewed by a qualified legal professional before deployment in a production environment.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
