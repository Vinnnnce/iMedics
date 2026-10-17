# Dashboard & Homepage Roadmap

> Status: planned. This document defines the phased build-out of the iMedics homepage and role-based dashboards. It is a planning document only — it does not change any application code.

## Phase 1: Foundations

- Build role-based authentication and navigation.
- Create shared UI components: cards, status chips, tables, filters, charts, modals, toasts, and empty states.
- Implement notification centre, toast system, email templates, and push-notification service.
- Build appointment, case, message, payment, and result data models.

## Phase 2: Patient dashboard

- Build patient greeting, upcoming appointment, pending results, messages, tasks, and payment widgets.
- Implement health timeline and case-number search.
- Add result-status tracking and critical-result alerts.
- Add secure document upload and record sharing.
- Build mobile-first layout and responsive breakpoints.

## Phase 3: Doctor dashboard

- Build today's schedule, next-patient summary, and clinical alerts.
- Add task queue for notes, prescriptions, referrals, and result reviews.
- Implement ICD-10-coded diagnosis workflow.
- Build earnings, subscription-status, and availability widgets.
- Add consultation templates and follow-up automation.

## Phase 4: Facility and admin dashboards

- Build facility booking, result queue, service catalogue, and revenue widgets.
- Add staff, room, and turnaround-time analytics.
- Build admin verification, payment, refund, dispute, and subscription-management screens.
- Add platform-wide reporting and audit exports.

## Phase 5: Advanced intelligence

- Add result-trend charts and care-gap detection.
- Add AI patient summaries, consultation documentation, and pre-visit intake.
- Add predictive no-show risk and schedule-optimization suggestions.
- Add wearable-data integration and personalized health insights.
- Add A/B testing for homepage conversion and dashboard engagement.

## Definition of Done

The homepage and dashboards are complete when:

- Each user role sees a personalized, actionable dashboard.
- Patients can manage appointments, records, results, messages, payments, and care tasks.
- Doctors can manage schedules, consultations, clinical tasks, earnings, subscriptions, and patient communication.
- Facilities can manage bookings, services, results, staff workload, and revenue.
- Admins can manage providers, payments, disputes, subscriptions, compliance, and platform health.
- All critical events trigger the appropriate toast, email, and push notifications.
- Sensitive health information is protected by authentication, role-based access, consent controls, encryption, and audit logging.
- The interface is responsive, accessible, fast, and usable on low-bandwidth mobile connections.
