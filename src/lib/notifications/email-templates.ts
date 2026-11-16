// Email templates for staff management notifications
// Path: src/lib/notifications/email-templates.ts

export const emailTemplates = {
  "staff-invitation": {
    subject: "You're invited to join {{ laboratoryName }}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Welcome to {{ laboratoryName }}!</h1>

        <p>Hi {{ name }},</p>

        <p>We're excited to have you join our team as a <strong>{{ role }}</strong>.</p>

        <p>To get started, please click the button below to create your account:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{{ invitationLink }}" style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Accept Invitation
          </a>
        </div>

        <p>If you have any questions, please don't hesitate to reach out.</p>

        {{ #welcomeMessage }}
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Welcome Message:</strong></p>
          <p>{{ welcomeMessage }}</p>
        </div>
        {{ /welcomeMessage }}

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This invitation link will expire in 7 days.
        </p>
      </div>
    `,
  },

  "credential-verified": {
    subject: "Your {{ credentialType }} has been verified",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00aa00;">✓ Credential Verified</h2>

        <p>Hi {{ name }},</p>

        <p>Your <strong>{{ credentialType }}</strong> credential has been verified and approved.</p>

        <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #00aa00; margin: 20px 0;">
          <p style="margin: 0; color: #00aa00;">Your credential is now active and recognized in the system.</p>
        </div>

        <p>If you have any questions about this verification, please contact your laboratory administrator.</p>
      </div>
    `,
  },

  "credential-rejected": {
    subject: "Your {{ credentialType }} requires attention",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #cc0000;">✗ Credential Needs Review</h2>

        <p>Hi {{ name }},</p>

        <p>Your <strong>{{ credentialType }}</strong> credential was reviewed and requires attention.</p>

        <div style="background-color: #ffebee; padding: 15px; border-left: 4px solid #cc0000; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #cc0000;">Reason for Review:</p>
          <p style="margin: 0; color: #cc0000;">{{ reason }}</p>
        </div>

        <p>Please contact your laboratory administrator to resolve this issue.</p>
      </div>
    `,
  },

  "credential-expiring": {
    subject: "Alert: Your {{ credentialType }} expires soon",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9800;">⚠️ Credential Expiry Alert</h2>

        <p>Hi {{ name }},</p>

        <p>Your <strong>{{ credentialType }}</strong> credential will expire on <strong>{{ expiryDate }}</strong>.</p>

        <p>You have <strong>{{ daysRemaining }} days</strong> to renew your credential.</p>

        <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0;">
          <p style="margin: 0; color: #ff9800;">Please take action to renew your credential before it expires to maintain continuous access.</p>
        </div>

        <p>Contact your laboratory administrator if you need assistance with renewal.</p>
      </div>
    `,
  },

  "staff-status-change": {
    subject: "Account status update",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Status Update</h2>

        <p>Hi {{ name }},</p>

        <p>{{ message }}</p>

        {{ #showDetails }}
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Current Status:</strong> {{ status }}</p>
        </div>
        {{ /showDetails }}

        <p>If you have any questions, please contact your laboratory administrator.</p>
      </div>
    `,
  },

  "staff-terminated": {
    subject: "Employment Termination Notice",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Employment Termination</h2>

        <p>Hi {{ name }},</p>

        <p>This is to inform you that your employment at {{ laboratoryName }} has been terminated effective immediately.</p>

        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Important Information:</strong></p>
          <ul style="margin: 10px 0;">
            <li>Your account access has been revoked</li>
            <li>All active sessions have been terminated</li>
            <li>Please return any laboratory equipment</li>
          </ul>
        </div>

        <p>For questions regarding exit procedures, contact the HR department.</p>
      </div>
    `,
  },

  "credential-renewal-reminder": {
    subject: "Reminder: Renew your {{ credentialType }}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Credential Renewal Reminder</h2>

        <p>Hi {{ name }},</p>

        <p>This is a reminder that your <strong>{{ credentialType }}</strong> is expiring soon and needs renewal.</p>

        <div style="background-color: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0;">
          <p style="margin: 0;"><strong>License Number:</strong> {{ licenseNumber }}</p>
          <p style="margin: 10px 0 0 0;"><strong>Expires:</strong> {{ expiryDate }}</strong></p>
        </div>

        <p>Please start the renewal process now to avoid any gaps in your credentials.</p>

        <p>Contact your laboratory administrator for assistance.</p>
      </div>
    `,
  },
};

// Email sending configuration
interface EmailData {
  to: string;
  template: keyof typeof emailTemplates;
  data: Record<string, string | number | boolean>;
}

export async function sendEmail(options: EmailData) {
  const template = emailTemplates[options.template];
  if (!template) {
    console.error(`Email template not found: ${options.template}`);
    return;
  }

  let html = template.html;
  let subject = template.subject;

  // Replace template variables
  Object.entries(options.data).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    const replacement = String(value);
    html = html.replace(regex, replacement);
    subject = subject.replace(regex, replacement);
  });

  // TODO: Send email using your email provider (SendGrid, AWS SES, etc.)
  console.log(`Email sent to ${options.to}:`, { subject, template: options.template });
}
