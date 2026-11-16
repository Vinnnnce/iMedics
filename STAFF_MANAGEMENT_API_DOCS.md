# 🔧 **API Routes, Notifications & Reporting**
## Complete Staff Management System Integration

---

## **📡 API ROUTES**

### **1. ADD TEAM MEMBER**
**Endpoint:** `POST /api/lab-owner/team`

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@lab.com",
  "phoneNumber": "+1-555-0000",
  "role": "LABORATORY_TECHNICIAN",
  "specialization": "Clinical Chemistry",
  "permissionTemplate": "technician",
  "welcomeMessage": "Welcome to our team!",
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2025-01-15T00:00:00Z"
}
```

**Permission Templates:**
- `limited` - View-only access
- `technician` - Full test operations
- `senior` - Includes quality checks & approvals
- `admin` - Full laboratory management

**Response:**
```json
{
  "success": true,
  "staffId": "staff-uuid",
  "message": "Team member invited successfully"
}
```

**Triggers:**
- ✉️ Staff invitation email
- 📝 Audit log entry
- 🔐 Permission setup

---

### **2. UPDATE TEAM MEMBER**
**Endpoint:** `PUT /api/lab-owner/team/[staffId]`

**Request Body:**
```json
{
  "fullName": "Jane Doe",
  "phoneNumber": "+1-555-1111",
  "specialization": "Microbiology",
  "status": "ACTIVE"
}
```

**Status Values:**
- `ACTIVE` - Full access
- `ON_LEAVE` - Temporary suspension
- `SUSPENDED` - Access restricted
- `TERMINATED` - Employment ended

**Triggers:**
- ✉️ Status change email (if status changes)
- 📝 Audit log entry

---

### **3. DELETE/TERMINATE TEAM MEMBER**
**Endpoint:** `DELETE /api/lab-owner/team/[staffId]`

**Triggers:**
- ✉️ Termination notification email
- 📝 Audit log entry
- 🔒 Account access revoked

---

### **4. UPDATE PERMISSIONS**
**Endpoint:** `PUT /api/lab-owner/team/[staffId]/permissions`

**Request Body:**
```json
{
  "permissions": [
    "view_samples",
    "create_sample",
    "conduct_test",
    "upload_results",
    "approve_results"
  ]
}
```

**Available Permissions:**
- **Sample Management:** view_samples, create_sample, modify_sample, archive_sample
- **Test Operations:** view_tests, conduct_test, upload_results, approve_results, quality_check
- **Reports:** view_reports, generate_report, export_data, manage_documents
- **Equipment:** view_equipment, log_usage, schedule_maintenance, equipment_reports
- **Staff Coordination:** view_team, assign_tasks, manage_schedule, view_performance
- **Billing:** view_billing, manage_payments, export_financial

**Triggers:**
- 📝 Audit log with added/removed permissions
- 🔐 Permissions updated immediately

---

### **5. VERIFY CREDENTIAL**
**Endpoint:** `POST /api/lab-owner/team/[staffId]/credentials`

**Request Body:**
```json
{
  "credentialId": "cred-uuid",
  "decision": "VERIFIED",
  "notes": "All documentation complete"
}
```

**Decision Values:** `VERIFIED` | `REJECTED`

**Triggers:**
- ✉️ Credential status email (verified/rejected)
- 📝 Audit log entry
- 🔐 Access status updated if needed

---

### **6. DELETE CREDENTIAL**
**Endpoint:** `DELETE /api/lab-owner/team/[staffId]/credentials/[credentialId]`

**Triggers:**
- 📝 Audit log entry
- ⚠️ Staff status review (may trigger suspension if no valid credentials remain)

---

## **📧 EMAIL NOTIFICATIONS**

### **Email Templates**

| Template | Trigger | Recipient | Purpose |
|----------|---------|-----------|---------|
| `staff-invitation` | New staff added | Staff email | Onboarding invitation |
| `credential-verified` | Credential approved | Staff email | Confirmation of credential verification |
| `credential-rejected` | Credential rejected | Staff email | Rejection with reason |
| `credential-expiring` | 90/30/7 days before expiry | Staff email | Credential expiry alerts |
| `staff-status-change` | Status changes | Staff email | Account status updates |
| `staff-terminated` | Staff deleted | Staff email | Termination notice |
| `credential-renewal-reminder` | Manual trigger | Staff email | Renewal reminders |

### **Email Template Variables**

**Staff Invitation:**
```
{{ name }} - Staff member name
{{ laboratoryName }} - Lab name
{{ role }} - Staff role
{{ invitationLink }} - Signup link
{{ welcomeMessage }} - Custom welcome message
```

**Credential Status:**
```
{{ name }} - Staff member name
{{ credentialType }} - Type of credential
{{ expiryDate }} - Expiration date
{{ daysRemaining }} - Days until expiry
{{ licenseNumber }} - License number
{{ reason }} - Rejection reason
```

### **Sending Custom Emails**

```typescript
import { sendEmail } from "@/lib/notifications/email-templates";

await sendEmail({
  to: "staff@lab.com",
  template: "credential-expiring",
  data: {
    name: "John Doe",
    credentialType: "Medical License",
    expiryDate: "2024-03-15",
    daysRemaining: "30",
  },
});
```

---

## **📊 REPORTING FEATURES**

### **1. COMPLIANCE REPORT**
**Endpoint:** `GET /api/lab-owner/team/reports?type=compliance`

**Response:**
```json
{
  "generatedAt": "2024-01-15T10:30:00Z",
  "summary": {
    "totalStaff": 15,
    "activeStaff": 13,
    "suspendedStaff": 2,
    "credentialsExpired": 1,
    "credentialsExpiringIn30Days": 3,
    "credentialsExpiringIn90Days": 5
  },
  "details": [
    {
      "name": "John Doe",
      "email": "john@lab.com",
      "role": "Lab Technician",
      "status": "ACTIVE",
      "totalCredentials": 2,
      "verifiedCredentials": 2,
      "expiredCredentials": 0,
      "expiringIn30Days": 0,
      "expiringIn90Days": 1,
      "complianceStatus": "COMPLIANT"
    }
  ]
}
```

**Use Cases:**
- Compliance audits
- Staff credential verification
- Risk assessment
- Annual reviews

---

### **2. ACTIVITY REPORT**
**Endpoint:** `GET /api/lab-owner/team/reports?type=activity`

**Response:**
```json
{
  "generatedAt": "2024-01-15T10:30:00Z",
  "totalEvents": 250,
  "eventsByType": [
    {
      "action": "STAFF_INVITED",
      "count": 5,
      "lastOccurred": "2024-01-15T09:20:00Z"
    },
    {
      "action": "CREDENTIAL_VERIFIED",
      "count": 12,
      "lastOccurred": "2024-01-14T14:30:00Z"
    },
    {
      "action": "PERMISSIONS_UPDATED",
      "count": 8,
      "lastOccurred": "2024-01-13T11:00:00Z"
    }
  ],
  "recentActivity": [
    {
      "id": "event-uuid",
      "action": "STAFF_INVITED",
      "actorId": "user-uuid",
      "occurredAt": "2024-01-15T09:20:00Z",
      "details": { "staffName": "Jane Smith" }
    }
  ]
}
```

**Use Cases:**
- Audit trails
- Change tracking
- Admin accountability
- System monitoring

---

### **3. CREDENTIALS REPORT**
**Endpoint:** `GET /api/lab-owner/team/reports?type=credentials`

**Response:**
```json
{
  "generatedAt": "2024-01-15T10:30:00Z",
  "summary": {
    "totalCredentials": 30,
    "verifiedCredentials": 28,
    "pendingCredentials": 1,
    "rejectedCredentials": 1,
    "expiredCredentials": 0,
    "expiringIn30Days": 2,
    "expiringIn90Days": 5
  },
  "credentials": {
    "expired": [],
    "expiringIn30": [
      {
        "staffName": "John Doe",
        "staffEmail": "john@lab.com",
        "type": "Lab License",
        "licenseNumber": "LIC-12345",
        "expiryDate": "2024-02-10",
        "daysRemaining": 26
      }
    ],
    "expiringIn90": [...]
  }
}
```

**Use Cases:**
- Renewal planning
- Compliance tracking
- Risk management
- Staff qualifications verification

---

### **4. ACTIVITY EXPORT (CSV)**
**Endpoint:** `GET /api/lab-owner/team/reports?type=export-csv`

**File Format:** `team-activity-2024-01-15.csv`

**CSV Columns:**
```
Date,Time,Action,Actor ID,Details
2024-01-15,09:20:00,STAFF_INVITED,user-uuid,"{""staffName"":""Jane Smith""}"
2024-01-14,14:30:00,CREDENTIAL_VERIFIED,user-uuid,"{""credentialType"":""Lab License""}"
```

**Use Cases:**
- External audits
- Compliance documentation
- Data archival
- Custom analysis

---

## **🔔 AUTOMATED MONITORING**

### **Credential Expiry Monitoring Service**

**File:** `src/lib/services/credential-monitor.ts`

**Function:** `runCredentialMonitoring()`

**Checks:**
- Credentials expiring in 90 days → Send alert
- Credentials expiring in 30 days → Send alert
- Credentials expiring in 7 days → Send alert
- Expired credentials → Suspend staff if no valid credentials

**Deployment:**
```bash
# Run via cron job endpoint (recommended)
GET /api/cron/credential-monitoring?token=YOUR_CRON_SECRET_TOKEN

# Or schedule with external service:
# - Vercel Crons
# - AWS EventBridge
# - Google Cloud Scheduler
# - EasyCron.com
```

**Setup:**
```env
# .env.local
CRON_SECRET_TOKEN=your-secret-token-here
```

---

## **🚀 SETUP GUIDE**

### **1. Environment Variables**
```env
# Email service
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=noreply@yourlab.com

# Cron monitoring
CRON_SECRET_TOKEN=generate-secure-token

# App URL for email links
APP_URL=https://yourdomain.com
```

### **2. Email Provider Setup**
Currently configured for SendGrid. To use another provider:

```typescript
// src/lib/notifications/email-templates.ts
export async function sendEmail(options: EmailData) {
  // Replace with your email service:
  // - SendGrid
  // - AWS SES
  // - Mailgun
  // - Resend
  // - etc.
}
```

### **3. Cron Job Setup**
Choose one:

**Option A: Vercel Crons**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/credential-monitoring",
    "schedule": "0 9 * * *"
  }]
}
```

**Option B: External Service**
```bash
# Call daily at 9 AM UTC
curl "https://yourapp.com/api/cron/credential-monitoring?token=YOUR_CRON_SECRET_TOKEN"
```

---

## **📝 AUDIT TRAIL**

All actions are logged automatically:
- Staff added/updated/deleted
- Credentials verified/rejected
- Permissions changed
- Status changes
- Account access updates

**View Audit Logs:**
```typescript
const logs = await prisma.controlAuditEvent.findMany({
  where: { laboratoryId },
  orderBy: { occurredAt: "desc" },
});
```

---

## **🔐 SECURITY FEATURES**

✅ **Role-Based Access Control**
- Only lab owners can manage staff
- Authorization verified on all endpoints

✅ **Audit Logging**
- Every change is logged with actor and timestamp
- Immutable audit trail

✅ **Email Verification**
- Invitations include secure signup links
- Credentials expire and require renewal

✅ **Status-Based Access**
- Suspended/terminated staff lose access
- Automatic suspension for expired credentials

✅ **Permission Granularity**
- Specific permissions for different roles
- Custom permission combinations

---

## **📞 SUPPORT & TROUBLESHOOTING**

**Email not sending?**
- Check API key and email service configuration
- Review email template syntax
- Check spam folder for test emails

**Cron job not triggering?**
- Verify token in URL
- Check cron schedule syntax
- Review server logs for errors

**Reports returning empty?**
- Verify data exists in database
- Check date filters and ranges
- Confirm authorization

---

**This implementation provides enterprise-grade staff management with full automation, compliance tracking, and audit capabilities!** 🚀
