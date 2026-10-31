import type { AudienceSection, PolicySection } from "./types";
import { LEGAL_META } from "./types";

/**
 * Privacy Policy content for Nigerian healthcare compliance. Common sections
 * apply to every account; audience sections apply to that account type.
 */

export const PRIVACY_COMMON: PolicySection[] = [
  {
    id: "who-we-are",
    heading: "1. Who we are",
    paragraphs: [
      `${LEGAL_META.platformName} ("we", "us") is the telemedicine platform described in these policies, operated by ${LEGAL_META.operatorName}, with its registered office at ${LEGAL_META.operatorAddress} (RC ${LEGAL_META.operatorRc}). The operator's registered details are placeholders until confirmed and inserted.`,
      "Our role depends on what is being processed. For platform account and operational data — your login, bookings, payments and notifications — we are the data controller. For clinical records created in the course of care, the treating provider (or their facility) controls that clinical content and we process it on their behalf, which makes us a data processor for it.",
      `Privacy questions, data requests and complaints: ${LEGAL_META.contactEmail}. You can also complain to the Nigeria Data Protection Commission (NDPC), the national supervisory authority for the Nigeria Data Protection Act 2023.`,
      "This policy explains what data we collect, why, how it is shared and secured, how long we keep it, and your rights. It is written in plain language; it is not legal advice.",
    ],
  },
  {
    id: "legal-foundations",
    heading: "2. The law that protects your data",
    paragraphs: [
      "Your privacy is protected by Nigerian law, and we design the Service around these protections:",
    ],
    bullets: [
      "Section 37 of the Constitution of the Federal Republic of Nigeria 1999 (as amended) guarantees the privacy of your correspondence and personal information. Section 46 gives you the right to go to court if this right is breached, and section 45 sets the narrow, lawful limits on that right.",
      "The Nigeria Data Protection Act 2023 (NDPA) is Nigeria's general data protection law. It requires lawful, fair and transparent processing; limits processing to specified purposes; gives you enforceable rights (sections 34–38); requires impact assessments for high-risk processing (section 28); requires the NDPC to be notified of a qualifying breach within 72 hours and affected users to be told immediately where the risk is high (section 40); and restricts transfers of personal data outside Nigeria (sections 41–43). The NDPC's General Application and Implementation Directive 2025 (GAID) explains how the NDPA is applied in practice, including registration of data controllers and processors of major importance (section 44).",
      "The National Health Act 2014 protects the confidentiality of your health information (section 26), gives you the right of access to your health record and the right to be told about your care (sections 23–24), obliges health establishments to keep and secure records (sections 25 and 29), and limits disclosure of your health information to persons participating in your care.",
      "For providers, professional codes reinforce these duties: the MDCN Code of Medical Ethics for doctors, the MLSCN rules of professional conduct for medical laboratory scientists, and the RRBN's code for radiographers.",
      "The Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024) makes unauthorised access to your data a crime and requires service providers to protect the communications and traffic data they handle.",
    ],
  },
  {
    id: "data-we-collect",
    heading: "3. Data we collect",
    paragraphs: [
      "We collect only the data needed to run the Service for your account type. In summary:",
    ],
    bullets: [
      "Account and identity data: name, email, phone, gender, date of birth, profile photo, and (for providers) professional registration numbers and verification documents.",
      "Clinical data (for patients): your case file, medical history, allergies, medications, conditions, blood group and genotype, consultation records, prescriptions, laboratory and diagnostic orders and results, and documents you upload.",
      "Professional data (for providers): your public profile, services and prices, appointment availability, staff rosters, facility branches, departments and accreditation details, and any staff credentials you submit for verification.",
      "Transaction data: bookings, payments and receipts processed through a licensed payment gateway (Paystack), and provider earnings and payouts.",
      "Communications data: in-app messages between you and your care providers or patients, platform notifications (email, push and in-app), and feedback.",
      "Technical data: device information, IP addresses, session logs and security events, kept to keep the Service safe and to comply with lawful record-keeping duties.",
    ],
  },
  {
    id: "how-we-use",
    heading: "4. How we use your data (and why the law allows it)",
    paragraphs: [
      "We use your data to provide the Service: to create your account, verify providers, match patients with providers, run bookings, consultations, laboratory and diagnostic workflows, referrals, results and payments, to keep your records, and to protect the platform from abuse.",
      "Under the NDPA 2023, every use needs a lawful basis. Ours are:",
    ],
    bullets: [
      "Consent — for optional uses like marketing communications and non-essential cookies. You can withdraw consent at any time without affecting prior lawful processing.",
      "Performance of a contract — to deliver the services you (or your organisation) signed up for.",
      "Legal obligation — to meet duties under Nigerian law, including health record-keeping under the National Health Act 2014 and security duties under the Cybercrimes Act.",
      "Vital interests — to protect someone's life in an emergency, for example where a doctor needs urgent history during emergency care.",
      "Legitimate interests — to keep the Service secure, prevent fraud and abuse, and improve the platform, where these do not override your rights.",
    ],
    note: "Health data is sensitive data under the NDPA. It is processed only for the purposes of care, safety, legal compliance and platform operation — never for unrelated purposes, and never sold.",
  },
  {
    id: "medical-confidentiality",
    heading: "5. Medical confidentiality and access controls",
    paragraphs: [
      "Clinical confidentiality is the foundation of the Service. Health records are visible only to the people who need them: the patient, the providers involved in their care (for example, an assigned doctor, an ordered laboratory or a referred facility), and platform administrators who support and secure the service under strict access controls and audit logging.",
      "Providers are independent professionals bound by their own professional confidentiality duties (MDCN, MLSCN, RRBN) and by the National Health Act 2014. We enforce this technically: role-based permissions, verification before listing, and audit trails. We do not sell or advertise on the basis of health data.",
      "Consent to care is a clinical matter: your provider obtains and documents your informed consent for treatment, as their professional rules require. Booking or using the Service is not a substitute for that consent, and it does not let us use your health data for anything else.",
    ],
  },
  {
    id: "sharing",
    heading: "6. How data is shared",
    paragraphs: [
      "We share personal data only as needed to run the Service, as follows:",
    ],
    bullets: [
      "Between you and your care team: doctors see the records of patients who book them; laboratories and diagnostic centres see the orders and patient details needed to process them; referred facilities see the referral record; hospitals manage the records of patients they treat.",
      "With service providers (data processors) under contract: cloud hosting, authentication, email and push notifications, file storage, payment processing (Paystack) and the third-party AI model used for doctor-side draft explanations. Processors may only use data on our instructions and must protect it under the NDPA.",
      "With regulators and law enforcement where the law requires: for example, lawful court orders, NDPC directions, or statutory reporting duties. We do not hand over health data without a legal basis.",
      "For safety and fraud prevention: where necessary to protect patients, the public or the platform.",
    ],
  },
  {
    id: "cross-border",
    heading: "7. Data stored outside Nigeria",
    paragraphs: [
      "Some of our infrastructure (cloud hosting, file storage, authentication, email, AI processing) may be operated by providers with servers outside Nigeria. The NDPA 2023 (sections 41–43) permits cross-border transfers only where the destination protects the data adequately — for example under a legally binding instrument approved by the NDPC. We select processors on that basis and require them to keep your data secure wherever it is processed.",
      "If you would like more detail about where specific data is stored, contact us at " + LEGAL_META.contactEmail + ".",
    ],
  },
  {
    id: "ai-processing",
    heading: "8. AI-assisted features",
    paragraphs: [
      "Some doctor-side features send laboratory result values to a third-party AI model to draft plain-language explanations and case summaries. These drafts are reviewed by the responsible doctor before they are released to a patient's record or shown to the patient. Patients never see unreviewed AI output.",
    ],
  },
  {
    id: "security",
    heading: "9. How we protect your data",
    paragraphs: [
      "We use encryption in transit, access controls, role-based permissions, audit logging, verification of providers, and monitoring to protect the Service. We limit access to patient data to the people who need it for their work.",
      "If a personal data breach occurs, the NDPA 2023 (section 40) sets two duties: where the breach is likely to result in a risk to your rights and freedoms, we notify the NDPC within 72 hours of becoming aware; and where it is likely to result in a high risk, we tell the affected users immediately, in plain language, including steps you can take. You can help by keeping your password private and telling us promptly at " + LEGAL_META.contactEmail + " if you suspect unauthorised access to your account.",
    ],
  },
  {
    id: "your-rights",
    heading: "10. Your rights under the NDPA",
    paragraphs: [
      "Whatever your account type, the NDPA 2023 gives you enforceable rights over your personal data:",
    ],
    bullets: [
      "Right of access — to know what data we hold about you and get a copy;",
      "Right to rectification — to correct data that is wrong or incomplete;",
      "Right to erasure ('right to be forgotten') — to have your data deleted where the law allows;",
      "Right to restriction and objection — to stop or limit certain processing, including profiling;",
      "Right to data portability — to receive your data in a structured, commonly used format where you ask for it;",
      "Right not to be subject to a decision based solely on automated processing that significantly affects you (section 38) — our AI features are drafting aids reviewed by qualified people, not automated decision-makers;",
      "Right to withdraw consent — for any processing based on consent, without affecting what was lawfully done before;",
      "Right to complain — to us and to the NDPC (www.ndpc.gov.ng).",
    ],
    note: "Health records have a special status. Doctors, hospitals, laboratories and diagnostic centres have legal and professional duties to retain clinical records (National Health Act 2014, section 25). When you ask us to delete data, we will delete what the law allows, keep what the law requires (for example, retention of clinical records for the legally required period), and explain to you exactly what was retained and why.",
  },
  {
    id: "retention",
    heading: "11. How long we keep data",
    paragraphs: [
      "We keep data only as long as necessary: account data for the life of your account; transaction data for as long as needed for accounting and disputes; technical and security logs for a limited, security-driven period consistent with the Cybercrimes Act 2015 (as amended); and clinical records for the periods that the National Health Act 2014, professional standards and Nigerian law require — because health records must be preserved by the providers who create them, not simply deleted on request.",
      "When you close your account, we deactivate it and remove personal data that the law does not require us to keep. Records that must be retained are kept securely, with access limited to legal, safety and audit needs.",
    ],
  },
  {
    id: "children",
    heading: "12. Children",
    paragraphs: [
      "The Service is not directed at children under 18. Where a minor's data must be processed — for example, when a parent or guardian arranges care for their child — we do so only with the consent of a parent or guardian, as the NDPA 2023 requires.",
    ],
  },
  {
    id: "changes",
    heading: "13. Changes to this policy",
    paragraphs: [
      "We review this policy regularly and will notify you of material changes by email or platform notification before they take effect. The version in force when you accepted the Terms is recorded with your account.",
    ],
  },
];

export const PRIVACY_AUDIENCES: AudienceSection[] = [
  {
    audience: "PATIENT",
    sections: [
      {
        id: "patient-privacy",
        heading: "For patients",
        paragraphs: [
          "Your health data belongs to you. Here is how the Service handles it in practice:",
        ],
        bullets: [
          "Who can see your records: you; the doctors who treat you; the hospitals, laboratories and diagnostic centres that process your orders or referrals; and platform administrators who support the service under access controls. Nobody else.",
          "Booking and consent: when you book a consultation, order a test or accept a referral, the provider involved gets only the information needed to care for you. You can see and manage your case file, history, results and prescriptions in your account.",
          "Your rights in practice: you can view and download your records, ask us to correct anything wrong, and request deletion of anything the law does not require to be kept. Write to " + LEGAL_META.contactEmail + " and we will respond and explain what we did.",
          "AI: doctors may use AI to help draft plain-language explanations of your results. A doctor always reviews them before you see them, and they never replace your doctor's judgement.",
          "Emergencies: in a genuine emergency, providers may access or share your information to protect your life (National Health Act 2014, section 27; NDPA vital interests).",
        ],
      },
    ],
  },
  {
    audience: "DOCTOR",
    sections: [
      {
        id: "doctor-privacy",
        heading: "For doctors",
        paragraphs: [
          "As a doctor you process patient data through the platform. Your account-specific privacy position:",
        ],
        bullets: [
          "Professional data: your registration and licence details are used for verification; your verified status (not your underlying verification documents) is reflected on your public profile.",
          "Patient access: you can see the records of patients who book you or are referred to you, for the purpose of their care.",
          "Your confidentiality duties: the MDCN Code of Medical Ethics and the National Health Act 2014 apply to everything you see on the platform. Do not copy patient data outside the platform without a lawful basis.",
          "AI features: when you use AI-assisted explanations or case summaries, laboratory data is processed by our third-party AI provider to produce a draft. You must review drafts before releasing them. Do not paste patient data into external tools that are not part of the platform.",
          "Patients' rights: if a patient asks you to correct, restrict or delete their data, work with us and the patient to resolve it lawfully — including honouring access requests for records you hold about their care.",
        ],
      },
    ],
  },
  {
    audience: "HOSPITAL",
    sections: [
      {
        id: "hospital-privacy",
        heading: "For hospitals",
        paragraphs: [
          "As a hospital account you manage patient and staff data on the platform:",
        ],
        bullets: [
          "You are a data controller for the patient data you process. We are a processor for the platform-side records. You must comply with the NDPA 2023, the National Health Act 2014 (sections 25–29) and your own institutional policies.",
          "Staff management: staff invitations, roles and credential records let you control who sees patient data. Remove access promptly when staff leave. Their personal data is processed for verification and rostering only.",
          "Patient data: your clinicians see the records of patients they treat. You are responsible for clinical confidentiality and for the security of records created by your staff.",
          "Registration: the NDPC GAID 2025 treats health-sector data controllers of major importance as registrable with the NDPC. Where your processing meets the thresholds, your own NDPC registration is your responsibility; ours is ours.",
        ],
      },
    ],
  },
  {
    audience: "LABORATORY",
    sections: [
      {
        id: "laboratory-privacy",
        heading: "For laboratories",
        paragraphs: [
          "As a laboratory account you process sensitive patient data — samples, orders and results:",
        ],
        bullets: [
          "You see the patient details attached to the orders you accept (identified by case number), for the purpose of processing the order and releasing results — nothing more.",
          "Result release is a controlled workflow: results you release become visible to the patient and the ordering doctor. Verify results before release; you are responsible for their accuracy.",
          "Confidentiality and security duties under the National Health Act 2014, the MLSCN rules of professional conduct and the NDPA 2023 apply to everything you process on the platform.",
          "Staff credential data is used for verification and rostering only, and should be collected only from staff who consent to their credentials being verified.",
        ],
      },
    ],
  },
  {
    audience: "DIAGNOSTIC_CENTRE",
    sections: [
      {
        id: "diagnostic-centre-privacy",
        heading: "For diagnostic centres",
        paragraphs: [
          "As a diagnostic centre account you process patient data for investigations and reports:",
        ],
        bullets: [
          "You see the patient details attached to the investigations and referrals you accept, for the purpose of performing and reporting them.",
          "Report release is a controlled workflow (drafting, review, release). Patients and referring providers see only what you release. You are responsible for the professional quality of released reports.",
          "Confidentiality and security duties under the National Health Act 2014, the RRBN code for imaging professionals, and the NDPA 2023 apply to your use of the platform.",
          "Staff credential data is used for verification and rostering only, with the consent of the staff concerned.",
        ],
      },
    ],
  },
  {
    audience: "PHARMACY",
    sections: [
      {
        id: "pharmacy-privacy",
        heading: "For pharmacies",
        paragraphs: [
          "As a pharmacy account you process patient data for medication orders and dispensing:",
        ],
        bullets: [
          "You see the patient details attached to the medication orders you review and dispense, for the purpose of safe dispensing only.",
          "Dispensing is a controlled workflow (review, dispense, completion). Patients and prescribers see the status you record. Dispensing decisions remain with your licensed pharmacists.",
          "Confidentiality and security duties under the National Health Act 2014, the PCN code of ethics, and the NDPA 2023 apply to your use of the platform.",
          "Staff credential data is used for verification and rostering only, with the consent of the staff concerned.",
        ],
      },
    ],
  },
];
