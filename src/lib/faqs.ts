import type { AccountType } from "@prisma/client";
import type { PolicyAudience } from "./legal/types";

/**
 * Frequently asked questions, keyed by audience. FAQs are shown only on the
 * homepage (general) and on the dashboard of the matching account type —
 * never in the sidebar footer or on other pages.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQs for a facility portal user, based on the facility's account type.
 * Returns an empty list when the account type is unknown so that nothing
 * is silently shown for the wrong audience.
 */
export function facilityFaqs(accountType: AccountType | null | undefined): FaqItem[] {
  switch (accountType) {
    case "HOSPITAL":
      return FAQS.HOSPITAL;
    case "LABORATORY":
      return FAQS.LABORATORY;
    case "DIAGNOSTIC_CENTRE":
      return FAQS.DIAGNOSTIC_CENTRE;
    case "PHARMACY":
      return FAQS.PHARMACY;
    default:
      return [];
  }
}

export const FAQS: Record<PolicyAudience, FaqItem[]> = {
  GENERAL: [
    {
      question: "What is Medic1905?",
      answer:
        "Medic1905 is a Nigerian telemedicine platform that connects patients with verified doctors, hospitals, laboratories, diagnostic centres and pharmacies. You can find a provider, book a consultation (video, chat or in person), order laboratory tests, receive diagnostic reports and manage a secure health record.",
    },
    {
      question: "Who can register?",
      answer:
        "Six account types: patients, doctors, hospitals, laboratories, diagnostic centres and pharmacies. Doctors must be registered with the Medical and Dental Council of Nigeria (MDCN); facilities must be registered organisations with the licences required for their services. Providers are verified by our team before they are listed.",
    },
    {
      question: "How do you verify doctors and facilities?",
      answer:
        "We check professional registration and licence details at sign-up (for example, MDCN registration for doctors, and facility registration and licensing for hospitals, laboratories and diagnostic centres). Verification confirms identity and status — it is not a clinical endorsement or a substitute for a regulator's own licensing.",
    },
    {
      question: "How do payments work?",
      answer:
        "You see the price before you book. Payments are processed through a licensed payment gateway (Paystack) — we never handle your card details. Providers receive their earnings after the platform commission is deducted.",
    },
    {
      question: "Is my health data private?",
      answer:
        "Yes. Your records are visible only to you and the providers involved in your care, and are protected by the Nigerian Constitution, the National Health Act 2014 and the Nigeria Data Protection Act 2023. See our Privacy Policy for full details.",
    },
    {
      question: "Can Medic1905 handle emergencies?",
      answer:
        "No. If you or someone else has a medical emergency, call the national emergency number 112 or go to the nearest hospital immediately.",
    },
  ],
  PATIENT: [
    {
      question: "How do I book a consultation?",
      answer:
        "Use Find care or the Doctors page, choose a verified doctor, pick an available slot and pay the consultation fee. Video, chat and in-person options are offered depending on the doctor.",
    },
    {
      question: "How do I get my laboratory or diagnostic results?",
      answer:
        "Order a test or accept a referral, and the laboratory or diagnostic centre processes it. You are notified when results are released to your case file — only after the provider has verified them.",
    },
    {
      question: "Who can see my health records?",
      answer:
        "Only you, the providers involved in your care (your doctors, and the hospitals, laboratories or diagnostic centres handling your orders and referrals), and platform administrators who support the service under strict access controls. See the Privacy Policy for details.",
    },
    {
      question: "Can I request deletion of my data?",
      answer:
        "Yes. Write to privacy@medic1905.com and we will delete what the law allows and explain what must be retained — clinical records have legal retention requirements under the National Health Act 2014.",
    },
    {
      question: "What if I need to cancel a booking?",
      answer:
        "Cancel from your appointments page. Refunds follow the platform's published payment policy; refund-eligible cases are handled by the platform's payments team. Refund status is shown in your payments.",
    },
    {
      question: "Are the AI explanations of my results written by a doctor?",
      answer:
        "AI helps doctors draft plain-language explanations of laboratory values, but a doctor always reviews the explanation before you see it, and it never replaces your doctor's judgement.",
    },
  ],
  DOCTOR: [
    {
      question: "How do I get verified?",
      answer:
        "Submit your MDCN registration and licence details at sign-up. Our administrators check them against MDCN records before your profile goes live. Keep your registration details current, and tell us promptly if your licence status changes.",
    },
    {
      question: "How are my fees and earnings handled?",
      answer:
        "You set your own consultation fees. Patients pay through the platform, the commission is deducted, and your share is settled through the payment gateway's payout arrangements. Receipts are available in your account.",
    },
    {
      question: "How do AI-assisted features work?",
      answer:
        "AI can draft plain-language explanations of laboratory values and case summaries. Every draft must be reviewed by you before it is released to a patient's record. Patients never see unreviewed AI output.",
    },
    {
      question: "What are my obligations for telemedicine?",
      answer:
        "The MDCN Code of Medical Ethics and its telemedicine rules apply to your use of the platform: verify patient identity, document consent for remote care, recognise when a case needs in-person attendance or referral, and keep patient information confidential.",
    },
    {
      question: "Can patients request corrections to their records?",
      answer:
        "Yes. Under the Nigeria Data Protection Act 2023 patients can ask for corrections. Work with us and the patient to resolve such requests lawfully, including access requests for records held about their care.",
    },
  ],
  HOSPITAL: [
    {
      question: "How do we get our hospital listed?",
      answer:
        "Register a hospital account with your organisation's CAC registration and facility licence details. Our administrators verify them before your services, departments and branches go live.",
    },
    {
      question: "How do we manage staff access?",
      answer:
        "Invite staff from your facility workspace and assign roles (manager, doctor, nurse, receptionist and so on). Access to patient data follows these roles — remove staff promptly when they leave.",
    },
    {
      question: "How do referrals from doctors work?",
      answer:
        "Doctors can refer patients to your hospital for specific services. You accept, decline and fulfil referrals from your workspace, and the referring doctor and patient see the status.",
    },
    {
      question: "What are our data protection duties?",
      answer:
        "As a hospital you are a data controller for the patient data you process: keep patient information confidential and secure under the National Health Act 2014 and the Nigeria Data Protection Act 2023, honour patients' access rights, and manage NDPC registration where your processing meets the thresholds.",
    },
    {
      question: "How are we paid?",
      answer:
        "Patients pay for your services through the platform. The commission is deducted and your share is settled through the payment gateway's payout arrangements.",
    },
  ],
  LABORATORY: [
    {
      question: "What do we need to register?",
      answer:
        "Register a laboratory account with your organisation's CAC registration and MLSCN registration details. We verify them before your test catalogue goes live.",
    },
    {
      question: "How do we receive and process orders?",
      answer:
        "Doctors and patients order tests from your catalogue. You accept the order, collect or receive the sample, and process it in your workspace, which tracks the workflow through to verified release.",
    },
    {
      question: "How are results released?",
      answer:
        "Enter results, have them verified by qualified staff, then release them. Released results go to the patient's case file and notify the patient and ordering doctor. You are responsible for the accuracy of everything you release.",
    },
    {
      question: "What are our confidentiality duties?",
      answer:
        "Patient information you see on the platform is confidential under the National Health Act 2014, the MLSCN rules of professional conduct and the Nigeria Data Protection Act 2023 — process it only for the order at hand.",
    },
    {
      question: "How are we paid?",
      answer:
        "Patients pay for tests through the platform. The commission is deducted and your share is settled through the payment gateway's payout arrangements.",
    },
  ],
  DIAGNOSTIC_CENTRE: [
    {
      question: "What do we need to register?",
      answer:
        "Register a diagnostic centre account with your organisation's CAC registration and the permits required for your services — typically radiography practice registration with the Radiographers Registration Board of Nigeria (RRBN), and MLSCN registration for on-site laboratory tests.",
    },
    {
      question: "How do we handle referrals and investigations?",
      answer:
        "Doctors refer patients for investigations, and patients book directly from your service catalogue. You track each case through your workspace from check-in to released report.",
    },
    {
      question: "How are reports released?",
      answer:
        "Draft the report, have it reviewed by an appropriately qualified professional, then release it. Released reports go to the patient's case file and notify the patient and referring provider.",
    },
    {
      question: "What are our confidentiality duties?",
      answer:
        "Patient information is confidential under the National Health Act 2014, the RRBN code and the Nigeria Data Protection Act 2023. Access is limited to staff who need it for the investigation at hand.",
    },
    {
      question: "How are we paid?",
      answer:
        "Patients pay for investigations through the platform. The commission is deducted and your share is settled through the payment gateway's payout arrangements.",
    },
  ],
  PHARMACY: [
    {
      question: "What do we need to register?",
      answer:
        "Register a pharmacy account with your organisation's CAC registration and pharmacy licence details. Pharmacies must be registered with the Pharmacists Council of Nigeria (PCN) and operate under the supervision of licensed pharmacists.",
    },
    {
      question: "How does the medication workflow work?",
      answer:
        "Prescribers submit medication orders and your pharmacy reviews, dispenses and tracks them from submission to completion. Dispensing decisions always remain with your licensed pharmacists — the platform records and communicates them, it never automates them.",
    },
    {
      question: "Can we manage our medicine catalogue?",
      answer:
        "Yes. Your formulary lists the medications and strengths you stock, and your own interaction rules are surfaced to reviewers as advisory alerts. Retired entries stay on record so history remains explainable.",
    },
    {
      question: "What are our data protection duties?",
      answer:
        "You see only the patient details attached to orders you handle, for safe dispensing. Keep patient information confidential and secure under the National Health Act 2014, the PCN code of ethics and the Nigeria Data Protection Act 2023.",
    },
    {
      question: "How are we paid?",
      answer:
        "Patients pay for your services through the platform. The commission is deducted and your share is settled through the payment gateway's payout arrangements.",
    },
  ],
};
