import type { AudienceSection, PolicySection } from "./types";
import { LEGAL_META } from "./types";

/**
 * Terms of Use content for Nigerian healthcare compliance.
 * Common sections apply to every account; each audience section applies to
 * that account type only. Section ids are stable anchors.
 */

export const TERMS_COMMON: PolicySection[] = [
  {
    id: "acceptance",
    heading: "1. Acceptance and scope",
    paragraphs: [
      `These Terms of Use ("Terms") govern your access to and use of the ${LEGAL_META.platformName} platform (the "Service"), operated by ${LEGAL_META.operatorName}, with its registered office at ${LEGAL_META.operatorAddress} (RC ${LEGAL_META.operatorRc}). The operator's registered details are placeholders until confirmed and inserted; the operator is expected to be a company incorporated under the Companies and Allied Matters Act 2020 and registered with the Corporate Affairs Commission ("we", "us", "our").`,
      "By creating an account, registering, or otherwise using the Service, you agree to be bound by these Terms, our Privacy Policy and our Cookies Policy. If you do not agree, you must not use the Service.",
      "These Terms apply to all account types: patients, doctors, hospitals, laboratories and diagnostic centres. Where a section applies only to your account type, it is marked as such. Where you provide services on behalf of an organisation (for example, as a hospital manager or facility owner), you confirm that you are authorised to accept these Terms on that organisation's behalf.",
    ],
  },
  {
    id: "nature-of-service",
    heading: "2. What the Service is — and is not",
    paragraphs: [
      `${LEGAL_META.platformName} is a technology platform that connects patients with independent, verified healthcare providers — doctors, hospitals, laboratories and diagnostic centres. We facilitate booking, secure messaging, clinical record-keeping, laboratory orders and results, referrals and payments.`,
      "We are not a hospital, clinic, pharmacy or medical provider. We do not practise medicine, employ or contract with healthcare providers as their clinical employer, and we do not direct or control clinical judgement. All diagnosis, treatment, prescriptions, laboratory analyses and clinical reports are the sole responsibility of the licensed provider performing them.",
      "The platform includes AI-assisted features for doctors (such as draft explanations of laboratory values). AI output is informational only, is never shown to patients without review by a qualified provider, and does not replace professional judgement.",
      "The Service is not for emergencies. If you or someone else has a medical emergency, call the national emergency number 112 or go to the nearest hospital immediately.",
    ],
  },
  {
    id: "nigerian-law",
    heading: "3. Nigerian legal framework",
    paragraphs: [
      "Your use of the Service is governed by the laws of the Federal Republic of Nigeria, including in particular:",
    ],
    bullets: [
      "the Constitution of the Federal Republic of Nigeria 1999 (as amended), which guarantees the privacy of your correspondence and personal data (section 37), subject to lawful limitations that are reasonably justifiable in a democratic society (section 45);",
      "the National Health Act 2014, which protects the confidentiality of health information, patients' right of access to their health records, and the duty of health establishments to secure those records (sections 23–29);",
      "the Nigeria Data Protection Act 2023 and the guidance of the Nigeria Data Protection Commission (NDPC), including the NDPC General Application and Implementation Directive 2025, which govern how personal and health data must be processed;",
      "the Medical and Dental Council of Nigeria (MDCN) Code of Medical Ethics and the Medical and Dental Practitioners Act (Cap M8 LFN 2004) for doctors, including its telemedicine practice rules;",
      "the Medical Laboratory Science Council of Nigeria (MLSCN) Act 2003 and the Radiographers Registration Board of Nigeria Act (Cap R1 LFN 2004) for laboratories and diagnostic imaging services;",
      "the Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024), which criminalises unauthorised access to computer systems, data interference and unlawful interception of electronic communications; and",
      "the Companies and Allied Matters Act 2020 for the registration and conduct of the corporate entities that operate on the platform.",
    ],
    note: "These Terms summarise these laws in plain language for your convenience. They do not replace the laws themselves and are not legal advice.",
  },
  {
    id: "accounts",
    heading: "4. Accounts, verification and eligibility",
    paragraphs: [
      "You must register with a real name and accurate details, keep your credentials confidential, and use the Service only for lawful purposes. You must be at least 18 years old to create an account; a parent or guardian may manage the account of a minor, consistent with the Nigeria Data Protection Act 2023.",
      "Doctors, hospitals, laboratories and diagnostic centres are not listed publicly until our administrators verify them. Verification includes checking professional registration (for example, MDCN registration for doctors) and, for facilities, registration and licensing details. Verification confirms identity and status only — it is not a clinical endorsement, a warranty of service quality, or a substitute for the regulator's own licensing.",
      "You must keep your professional registration, licences and facility permits current, and tell us promptly if they lapse, are suspended or are withdrawn. We may suspend or remove any account that provides false verification information.",
    ],
  },
  {
    id: "conduct",
    heading: "5. Acceptable conduct",
    paragraphs: [
      "When using the Service you must not, among other things:",
    ],
    bullets: [
      "access accounts, records or data that are not yours, or attempt to gain unauthorised access to the platform or another user's account — this is a criminal offence under section 6 of the Cybercrimes Act 2015 (as amended);",
      "intercept, copy, alter or destroy data belonging to others (sections 12 and 16 of the Cybercrimes Act);",
      "use the Service to harass, defame, stalk or send offensive messages (section 24 of the Cybercrimes Act, as amended);",
      "upload malicious code, scrape or reverse-engineer the platform, or interfere with its operation;",
      "share another person's personal or health information without a lawful basis — including patient information you obtain through the Service;",
      "misrepresent your qualifications, licences or facility accreditation; or",
      "use the Service for any purpose that violates Nigerian law or your professional code of conduct.",
    ],
  },
  {
    id: "payments",
    heading: "6. Fees, payments and refunds",
    paragraphs: [
      "Doctors set their own consultation fees; hospitals, laboratories and diagnostic centres set their own service prices. Patients see the price before booking and paying. We process payments through a licensed payment gateway (Paystack) and never handle your card details directly.",
      "Our platform commission is deducted from provider earnings through the gateway's payout arrangements before the provider's share is settled. Receipts are available in your account.",
      "Refunds follow the platform's published payment policy: where a cancellation or booking qualifies for a refund, it is handled by the platform's payments team under that policy. Nothing in this section limits statutory consumer rights applicable under Nigerian law.",
    ],
  },
  {
    id: "ai-tools",
    heading: "7. AI-assisted features",
    paragraphs: [
      "Some doctor-side features use artificial intelligence (a third-party AI model) to draft explanations of laboratory results or case summaries. These drafts:",
    ],
    bullets: [
      "are informational only and are not a diagnosis, treatment recommendation or professional opinion;",
      "are reviewed and approved by the responsible doctor before they become part of your record; and",
      "must never be relied on without the independent clinical judgement of a licensed practitioner.",
    ],
    note: "If you are a patient, never delay or change treatment because of anything you read on the platform without discussing it with your doctor.",
  },
  {
    id: "content",
    heading: "8. Content and intellectual property",
    paragraphs: [
      "You keep ownership of the content you upload (including clinical notes, results and documents). You grant us a limited licence to host, display and process that content as needed to operate the Service for you and the patients and providers you interact with.",
      "The platform's software, design, branding and aggregated, de-identified data belong to us. You may not copy or reuse platform materials without permission.",
    ],
  },
  {
    id: "suspension",
    heading: "9. Suspension and termination",
    paragraphs: [
      "We may suspend or terminate your account if you breach these Terms, provide false verification information, pose a security or safety risk, or where required by law or a regulator (including the MDCN, MLSCN, RRBN, NDPC or a court). Where practical, we will tell you why.",
      "You may stop using the Service and request account deletion at any time. Deleting your account does not delete clinical records that the law and professional standards require us or your providers to retain — see the Privacy Policy for what deletion means for health records.",
    ],
  },
  {
    id: "liability",
    heading: "10. Disclaimers and limitation of liability",
    paragraphs: [
      "The Service is provided on an 'as is' and 'as available' basis. To the fullest extent permitted by Nigerian law:",
    ],
    bullets: [
      "we do not warrant that the Service will be uninterrupted, error-free or secure from all possible threats;",
      "we are not liable for the clinical decisions, acts or omissions of healthcare providers using the platform;",
      "we are not liable for outcomes arising from reliance on AI-generated, informational content; and",
      "we are not liable for indirect or consequential loss, except where Nigerian law (including the Constitution and the Nigeria Data Protection Act 2023) does not permit the exclusion of liability.",
    ],
  },
  {
    id: "governing-law",
    heading: "11. Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws of the Federal Republic of Nigeria. If a dispute arises:",
    ],
    bullets: [
      "first, the parties will attempt to resolve it through good-faith discussions within 30 days of written notice;",
      "if unresolved, the parties will refer it to mediation under the Arbitration and Mediation Act 2023 or another mediator they agree on; and",
      "if mediation fails, the dispute will be resolved by the competent courts of Nigeria.",
    ],
    note: "Nothing in this section prevents either party from seeking urgent interim relief from a court, or from complaining to a regulator — such as the NDPC or your professional council — at any time.",
  },
  {
    id: "changes",
    heading: "12. Changes to these Terms",
    paragraphs: [
      "We may update these Terms from time to time. We will notify you of material changes by email or platform notification at least 30 days before they take effect. Continuing to use the Service after that date means you accept the updated Terms. The version you accepted at registration is recorded with your account.",
    ],
  },
  {
    id: "contact",
    heading: "13. Contact",
    paragraphs: [
      `Questions about these Terms and all legal, privacy and data requests: ${LEGAL_META.contactEmail} (see the Privacy Policy for how to exercise your data rights).`,
    ],
  },
];

export const TERMS_AUDIENCES: AudienceSection[] = [
  {
    audience: "PATIENT",
    sections: [
      {
        id: "patient-responsibilities",
        heading: "For patients",
        paragraphs: [
          "You are responsible for the accuracy of the health information you provide, and for keeping your login secure. Your case file, history, results and prescriptions are visible to you and to the providers you consult — see the Privacy Policy for exactly who can see what.",
          "Consultations may be by video, chat or in person, depending on what the doctor offers. Telemedicine has limits: a doctor may ask you to attend in person or refer you to a facility when remote care is not appropriate. You may refuse any health service, and the doctor should explain the implications of refusing.",
          "Prescriptions are issued only after a consultation and only when clinically appropriate. Do not use the platform to seek prescriptions you do not need or to obtain medicines unlawfully.",
          "Payments: you see the price before you book and pay. Unpaid bookings hold their slot for a limited time. Refunds follow the platform's published payment policy; refund-eligible cases are handled by the platform's payments team.",
        ],
      },
    ],
  },
  {
    audience: "DOCTOR",
    sections: [
      {
        id: "doctor-responsibilities",
        heading: "For doctors",
        paragraphs: [
          "You must be registered with the Medical and Dental Council of Nigeria (MDCN) and hold a current practising licence, and you must practise only within the scope of that registration. Telemedicine practice in Nigeria is regulated by the MDCN, and the MDCN Code of Medical Ethics (including its telemedicine guidance) applies to your use of this platform as it does to your offline practice.",
        ],
        bullets: [
          "remain fully responsible for every clinical decision, consultation, prescription and referral you make through the Service;",
          "verify patient identity, obtain and document informed consent for remote care, and recognise when a case requires in-person attendance or referral;",
          "maintain patient confidentiality as required by the National Health Act 2014 and the MDCN Code of Medical Ethics — never share patient information outside the care relationship without a lawful basis;",
          "review all AI-generated drafts before releasing them into a patient record, and never present AI output as your own unverified clinical assessment;",
          "keep your MDCN registration details and licence status on the platform current; and",
          "comply with MDCN rules on advertising and professional conduct when writing your public profile.",
        ],
        note: "Your use of the platform does not create an employment or agency relationship between you and us. You are an independent practitioner, and your professional obligations run to your patients directly.",
      },
    ],
  },
  {
    audience: "HOSPITAL",
    sections: [
      {
        id: "hospital-responsibilities",
        heading: "For hospitals",
        paragraphs: [
          "Hospital accounts represent registered healthcare organisations. By registering, you confirm that the organisation is duly incorporated with the Corporate Affairs Commission and holds the licences, permits and registrations required for the services it offers — which, depending on the services, can include state and federal Ministry of Health facility registration, radiography practice registration with the Radiographers Registration Board of Nigeria, and MLSCN registration for any on-site laboratory.",
          "As a hospital you are a data controller for the patient data you process through the platform: you must keep patient information confidential (National Health Act 2014, sections 26–29), secure your records against unauthorised access, and honour patients' rights of access to their records. Manage staff accounts carefully — only invite staff who are authorised to see patient data, and remove them promptly when they leave.",
          "You are responsible for the accuracy of your service catalogue, prices, departments and branches, and for the quality and safety of the clinical services you deliver. The platform lists and books your services; it does not perform them.",
        ],
      },
    ],
  },
  {
    audience: "LABORATORY",
    sections: [
      {
        id: "laboratory-responsibilities",
        heading: "For laboratories",
        paragraphs: [
          "Laboratory accounts represent medical laboratories. You confirm that your laboratory is registered with the Medical Laboratory Science Council of Nigeria (MLSCN) as required by the MLSCN Act 2003, operates under the supervision of licensed Medical Laboratory Scientists, and holds the licences required for the tests you list.",
          "Your professional obligations include: accurate and timely results, verified by qualified staff before release; secure handling of patient samples, files and records; and confidentiality of patient information under the National Health Act 2014 and the MLSCN rules of professional conduct.",
          "The platform lets doctors and patients order tests, upload requests and receive results. Releasing a result to a patient's record is a clinical communication that must follow your verified result-release workflow. You remain responsible for the analytical validity of everything you publish through the platform.",
        ],
      },
    ],
  },
  {
    audience: "DIAGNOSTIC_CENTRE",
    sections: [
      {
        id: "diagnostic-centre-responsibilities",
        heading: "For diagnostic centres",
        paragraphs: [
          "Diagnostic centre accounts represent facilities offering imaging and diagnostic investigations (such as X-ray, ultrasound, CT, MRI and laboratory-based diagnostics, depending on the centre). You confirm that your centre is duly incorporated and holds the registrations and permits required for its services — which for imaging typically includes radiography practice registration with the Radiographers Registration Board of Nigeria (RRBN), and MLSCN registration where you run on-site laboratory tests.",
          "You are responsible for the clinical quality of the investigations and reports you deliver, the credentials and licences of the professionals you roster, and the confidentiality and security of patient data under the National Health Act 2014 and the Nigeria Data Protection Act 2023.",
          "Reports you release through the platform must be prepared and verified by appropriately qualified and licensed professionals. The platform's workflow (drafting, review, release) supports — but never replaces — your professional responsibility for the final report.",
        ],
      },
    ],
  },
];
