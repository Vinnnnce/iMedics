# Nigerian Legal Review Checklist — Medic1905

This checklist is for qualified Nigerian legal counsel reviewing the platform's
legal and compliance position before and after launch. It maps each item to the
files or processes it concerns, so review findings can be turned directly into
action items.

**Status legend:** ☐ not started · ◐ in progress · ✔ complete · N/A not applicable

**Policies under review:** `src/lib/legal/terms.ts`, `src/lib/legal/privacy.ts`,
`src/lib/legal/cookies.ts`, rendered at `/legal/terms`, `/legal/privacy`,
`/legal/cookies`; About page at `/about`.

---

## 1. Corporate and operator identity

- ☐ Confirm the operator's registered legal entity name, CAC registration
  number (RC) and registered office address, and replace the placeholders in
  `src/lib/legal/types.ts` (`LEGAL_META.operatorName`, `operatorRc`,
  `operatorAddress`).
- ☐ Confirm the entity type (private company limited by shares under CAMA 2020)
  and that its objects cover operating a digital health platform.
- ☐ Confirm the entity's registered details are displayed on the platform
  (website footer / About page), consistent with CAMA 2020 disclosure duties.
- ☐ Confirm the contact mailbox (`privacy@medic1905.com`) exists, is monitored,
  and routes privacy requests and complaints to a responsible person.
- ☐ Confirm tax registration (TIN) and VAT status for platform commissions and
  payment flows, with counsel/accountant sign-off.

## 2. Nigeria Data Protection Act 2023 and NDPC GAID 2025

- ☐ Determine whether the operator is a Data Controller/Processor of Major
  Importance (DCPMI) — health-sector processing is a designated sector under
  the GAID 2025 — and complete NDPC registration at the applicable tier.
- ☐ Appoint or engage a Data Protection Officer (or equivalent contact), and
  name them in the Privacy Policy.
- ☐ Conduct and document a Data Protection Impact Assessment (NDPA s. 28) for
  the processing of health data (consultations, laboratory results,
  diagnostic reports, AI processing).
- ☐ Verify the lawful basis mapping in `privacy.ts` §4 against actual
  processing operations; confirm consent, contract, legal obligation, vital
  interests and legitimate interests are each correctly claimed.
- ☐ Review the sensitive-data (health) processing conditions and confirm the
  additional conditions the NDPA requires for sensitive data are documented.
- ☐ Verify the breach procedure implements NDPA s. 40 correctly: NDPC notified
  within 72 hours where the breach is likely to result in a risk; affected
  users notified immediately where the risk is high. Test the escalation path.
- ☐ Review cross-border transfer position (NDPA ss. 41–43): identify every
  non-Nigeria processor (hosting, authentication, file storage, email, AI
  model, payment gateway), and confirm each is covered by an NDPC-recognised
  safeguard (e.g., approved contractual clauses) or GAID-compliant basis.
- ☐ Build and test a Data Subject Access Request (DSAR) workflow covering
  access, rectification, erasure, restriction, portability, objection and
  withdrawal of consent (NDPA ss. 34–38), including the clinical-records
  retention carve-out explained in the policy.
- ☐ Confirm records of processing activities are maintained as the GAID
  requires.
- ☐ Review the children's data position (parental/guardian consent) and
  whether any workflow could capture a minor's data without it.
- ☐ Confirm no automated decision-making falls within NDPA s. 38 without
  safeguards (AI features are drafting aids reviewed by humans — verify this
  remains true in the product).

## 3. National Health Act 2014 and clinical confidentiality

- ☐ Verify the platform's access controls match the policy's claims: only the
  patient, involved providers and administrators can see clinical records.
- ☐ Confirm health-record custody and retention duties (ss. 25, 29) are
  assigned to the right parties (provider vs platform) and a concrete
  retention schedule is defined and documented.
- ☐ Verify patient access-to-records requests are handled within a reasonable
  period and patients are informed of their rights (ss. 23–24).
- ☐ Review the emergency disclosure pathway (s. 27) for technical feasibility.

## 4. Professional regulation

- ☐ MDCN: confirm doctor verification actually checks MDCN registration and
  licence status; align onboarding copy with the MDCN Code of Medical Ethics
  and the MDCN telemedicine practice rules; review doctor profiles against
  MDCN advertising rules.
- ☐ MLSCN: confirm laboratory verification checks MLSCN registration and that
  result release requires qualified verification, consistent with the MLSCN
  Act 2003 and rules of professional conduct.
- ☐ RRBN: confirm diagnostic centre imaging services are verified against
  radiography practice registration where applicable.
- ☐ Confirm the platform's verification disclaimer (verification is not a
  clinical endorsement) is adequate, and decide whether facility accreditation
  evidence should be captured and displayed.
- ☐ Confirm the professional-referral workflow does not constitute improper
  fee-splitting under any professional rules.

## 5. Cybercrimes Act 2015 (as amended 2024)

- ☐ Verify technical and organisational security measures protect account
  data and health records against unauthorised access (ss. 6, 12, 16 offences
  as deterrents).
- ☐ Confirm logging and monitoring cover the traffic data the platform
  handles; document retention consistent with s. 38 where applicable.
- ☐ Document an incident response plan covering reporting to the National
  CERT/sectoral CERT where the amended Act requires it.

## 6. Consumer and payments

- ☐ Review the refund policy against the Federal Competition and Consumer
  Protection Act 2018 (no unfair terms; clear cancellation rights).
- ☐ Review Paystack terms of service, and the commission/payout structure,
  for disclosure adequacy in the Terms of Use.
- ☐ Confirm pricing display (pre-payment price visibility) and receipts meet
  consumer-protection expectations.
- ☐ Review subscription terms (plan changes, cancellation) for fairness.

## 7. Third-party processors and contracts

- ☐ Collect and review data processing agreements / terms for: authentication
  (Clerk), hosting and database, file storage, email, push notifications,
  payment gateway (Paystack), and the AI model provider used for doctor-side
  drafts. Each must permit only instructed processing and NDPA-compliant
  security.
- ☐ Confirm the AI provider's terms restrict training on customer data or
  otherwise align with the policy's statements.
- ☐ Confirm subprocessor lists are maintained and reviewed.

## 8. Content and communications

- ☐ Verify marketing communications are opt-in with easy withdrawal.
- ☐ Review notification content (appointment, results) for confidentiality —
  no clinical detail in push/email subject lines.
- ☐ Confirm the Cookie Policy matches actual cookie/local storage use (the
  platform currently uses strictly necessary plus device-local preferences
  only). If analytics cookies are added later, implement a consent banner.
- ☐ Confirm all legal pages carry the not-legal-advice disclaimer and that
  the version and last-updated date are accurate.

## 9. Governance and lifecycle

- ☐ Confirm terms-acceptance versioning (`termsVersion` recorded at
  registration) is retained as evidence, and define the process for notifying
  users of material policy changes (30-day notice is promised).
- ☐ Assign a compliance owner for: NDPC registration renewals, policy review
  cadence (annual), breach-response drills, and DSAR response times.
- ☐ Decide the professional indemnity / insurance position for providers and
  the platform, and whether the Terms of Use adequately disclose it.
- ☐ Confirm the dispute-resolution clause (negotiation → mediation under the
  Arbitration and Mediation Act 2023 → Nigerian courts) is enforceable and
  does not oust regulator complaints or urgent court relief.

## 10. Sign-off

| Area | Reviewer | Date | Result |
|---|---|---|---|
| Corporate/CAC | | | |
| NDPA/GAID | | | |
| NHA 2014 | | | |
| MDCN/MLSCN/RRBN | | | |
| Cybercrimes Act | | | |
| Consumer/payments | | | |
| Processor contracts | | | |
| Final policy text | | | |

---

*This checklist is an internal working document and does not constitute legal
advice. It should be completed by qualified Nigerian legal counsel.*
