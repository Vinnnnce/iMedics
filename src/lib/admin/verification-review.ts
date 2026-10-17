import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { badRequest, conflict, notFound } from "../errors";
import { DOCUMENT_KINDS, REQUIRED_KINDS, kindLabel, type ApplicantType } from "../verification";
import { queueNotification } from "../notifications/service";
import { writeAudit } from "../audit";

/** What a reviewer must confirm before an application can be approved. */
export const CHECKLISTS: Record<ApplicantType, { key: string; label: string }[]> = {
  DOCTOR: [
    { key: "identityMatches", label: "The name and details on the documents match the applicant" },
    { key: "registrationVerified", label: "The MDCN registration number is confirmed on the regulator's register" },
    { key: "licenceCurrent", label: "The practising licence is current and in good standing" },
    { key: "specialtySupported", label: "The stated specialty is supported by their credentials" },
  ],
  FACILITY: [
    { key: "identityMatches", label: "The organisation name on the documents matches the application" },
    { key: "cacVerified", label: "The CAC registration is confirmed on the CAC register" },
    { key: "licenceCurrent", label: "The facility licence is current and valid for the services offered" },
    { key: "contactVerified", label: "The address and contact details are genuine" },
  ],
};

export const REJECTION_REASONS = [
  "A required document is missing or unreadable",
  "The name on the documents does not match the application",
  "The registration or licence number could not be verified",
  "The licence has expired or is not in good standing",
  "The details provided are inconsistent",
] as const;

interface Field {
  label: string;
  value: string | null;
  /** Shown beside the value when something looks off. */
  flag?: string;
}
export interface Section {
  title: string;
  fields: Field[];
}

const present = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : String(v));
const fullDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(d);

const ageOn = (dob: Date, at = new Date()) => {
  let age = at.getFullYear() - dob.getFullYear();
  if (at < new Date(at.getFullYear(), dob.getMonth(), dob.getDate())) age -= 1;
  return age;
};

/** Everything a reviewer needs to decide, with automatic cross-checks. */
export async function getDossier(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, accountType: true, createdAt: true,
      termsAcceptedAt: true, termsVersion: true, lastLoginAt: true,
      doctorProfile: true,
      labStaffProfile: true,
    },
  });
  if (!user || (!user.doctorProfile && !user.labStaffProfile)) return null;

  const type: ApplicantType = user.doctorProfile ? "DOCTOR" : "FACILITY";
  const status = (user.doctorProfile ?? user.labStaffProfile)!.verificationStatus;

  const [documents, history] = await Promise.all([
    prisma.verificationDocument.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } }),
    prisma.verificationReview.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, decision: true, reason: true, checklist: true, createdAt: true, reviewer: { select: { name: true } } } }),
  ]);

  const sections: Section[] = [];
  const flags: string[] = [];
  const missing: string[] = [];
  const duplicates: { field: string; value: string; other: { id: string; name: string; status: string; role: string } }[] = [];
  const year = new Date().getFullYear();

  if (user.doctorProfile) {
    const d = user.doctorProfile;
    const age = d.dateOfBirth ? ageOn(d.dateOfBirth) : null;
    const yearFlag =
      d.yearOfRegistration && d.yearOfRegistration > year ? "In the future" :
      d.yearOfRegistration && d.dateOfBirth && d.yearOfRegistration < d.dateOfBirth.getFullYear() + 21 ? "Registered before age 21" : undefined;
    const expFlag = d.yearsOfExperience && d.yearOfRegistration && d.yearsOfExperience > year - d.yearOfRegistration + 1 ? "More than time since registration" : undefined;
    if (age !== null && age < 23) flags.push(`The applicant is ${age} years old, which is young for a qualified doctor.`);
    if (yearFlag) flags.push(`Year of registration: ${yearFlag.toLowerCase()}.`);
    if (expFlag) flags.push("Years of experience exceed the time since registration.");

    sections.push(
      { title: "Identity", fields: [
        { label: "Full name", value: [user.name.split(" ")[0], d.middleName, user.name.split(" ").slice(1).join(" ")].filter(Boolean).join(" ") },
        { label: "Date of birth", value: d.dateOfBirth ? `${fullDate(d.dateOfBirth)} (age ${age})` : null },
        { label: "Gender", value: present(d.gender) },
        { label: "Email", value: user.email },
        { label: "Phone", value: present(user.phone) },
        { label: "Location", value: present(d.location) },
      ] },
      { title: "Professional credentials", fields: [
        { label: "MDCN registration number", value: present(d.mdcnRegistrationNumber) },
        { label: "Practising licence number", value: present(d.licenseNumber) },
        { label: "Year of registration", value: present(d.yearOfRegistration), flag: yearFlag },
        { label: "Years of experience", value: present(d.yearsOfExperience), flag: expFlag },
        { label: "Specialty", value: present(d.specialty) },
        { label: "Affiliation", value: present(d.affiliation) },
      ] },
      { title: "About", fields: [{ label: "Biography", value: present(d.biography) }] },
    );

    for (const [label, value] of [["MDCN registration number", d.mdcnRegistrationNumber], ["Practising licence number", d.licenseNumber]] as const) if (!value) missing.push(label);
    if (!d.yearOfRegistration) missing.push("Year of registration");
    if (!d.specialty) missing.push("Specialty");
    if (!user.phone) missing.push("Phone number");
    if (!d.dateOfBirth) missing.push("Date of birth");

    const others = await prisma.user.findMany({
      where: {
        id: { not: userId },
        deletedAt: null,
        OR: [
          ...(d.mdcnRegistrationNumber ? [{ doctorProfile: { mdcnRegistrationNumber: d.mdcnRegistrationNumber } }] : []),
          ...(d.licenseNumber ? [{ doctorProfile: { licenseNumber: d.licenseNumber } }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
      select: { id: true, name: true, status: true, role: true, phone: true, doctorProfile: { select: { mdcnRegistrationNumber: true, licenseNumber: true } } },
    });
    for (const o of others) {
      if (d.mdcnRegistrationNumber && o.doctorProfile?.mdcnRegistrationNumber === d.mdcnRegistrationNumber) duplicates.push({ field: "MDCN registration number", value: d.mdcnRegistrationNumber, other: o });
      if (d.licenseNumber && o.doctorProfile?.licenseNumber === d.licenseNumber) duplicates.push({ field: "Practising licence number", value: d.licenseNumber, other: o });
      if (user.phone && o.phone === user.phone) duplicates.push({ field: "Phone number", value: user.phone, other: o });
    }
  } else {
    const f = user.labStaffProfile!;
    sections.push(
      { title: "Organisation", fields: [
        { label: "Organisation name", value: present(f.laboratoryName) },
        { label: "Type", value: present(user.accountType?.replace(/_/g, " ").toLowerCase()) },
        { label: "Organisation category", value: present(f.position) },
        { label: "CAC registration number", value: present(f.cacRegistrationNumber) },
        { label: "Facility licence number", value: present(f.facilityLicenseNumber) },
      ] },
      { title: "Location", fields: [
        { label: "Address", value: present(f.addressLine) },
        { label: "City", value: present(f.city) },
        { label: "State", value: present(f.state) },
      ] },
      { title: "Registered representative", fields: [
        { label: "Name", value: user.name },
        { label: "Email", value: user.email },
        { label: "Phone", value: present(user.phone) },
      ] },
    );
    if (!f.laboratoryName) missing.push("Organisation name");
    if (!f.cacRegistrationNumber) missing.push("CAC registration number");
    if (!f.facilityLicenseNumber) missing.push("Facility licence number");
    if (!f.addressLine && !f.city) missing.push("Address");
    if (!user.phone) missing.push("Phone number");

    const others = await prisma.user.findMany({
      where: {
        id: { not: userId },
        deletedAt: null,
        OR: [
          ...(f.cacRegistrationNumber ? [{ labStaffProfile: { cacRegistrationNumber: f.cacRegistrationNumber } }] : []),
          ...(f.facilityLicenseNumber ? [{ labStaffProfile: { facilityLicenseNumber: f.facilityLicenseNumber } }] : []),
          ...(f.laboratoryName ? [{ labStaffProfile: { laboratoryName: { equals: f.laboratoryName, mode: "insensitive" as const } } }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
        ],
      },
      select: { id: true, name: true, status: true, role: true, phone: true, labStaffProfile: { select: { cacRegistrationNumber: true, facilityLicenseNumber: true, laboratoryName: true } } },
    });
    for (const o of others) {
      const p = o.labStaffProfile;
      if (f.cacRegistrationNumber && p?.cacRegistrationNumber === f.cacRegistrationNumber) duplicates.push({ field: "CAC registration number", value: f.cacRegistrationNumber, other: o });
      if (f.facilityLicenseNumber && p?.facilityLicenseNumber === f.facilityLicenseNumber) duplicates.push({ field: "Facility licence number", value: f.facilityLicenseNumber, other: o });
      if (f.laboratoryName && p?.laboratoryName?.toLowerCase() === f.laboratoryName.toLowerCase()) duplicates.push({ field: "Organisation name", value: f.laboratoryName, other: o });
      if (user.phone && o.phone === user.phone) duplicates.push({ field: "Phone number", value: user.phone, other: o });
    }
  }

  const uploaded = new Set(documents.map((d) => d.kind));
  const missingDocuments = REQUIRED_KINDS[type].filter((k) => !uploaded.has(k)).map((k) => DOCUMENT_KINDS[k].label);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt, termsAcceptedAt: user.termsAcceptedAt, termsVersion: user.termsVersion, lastLoginAt: user.lastLoginAt, accountType: user.accountType },
    type,
    status,
    sections,
    flags,
    missingFields: missing,
    missingDocuments,
    duplicates,
    documents: documents.map((d) => ({ ...d, kindLabel: kindLabel(d.kind) })),
    history,
    checklist: CHECKLISTS[type],
  };
}
export type Dossier = NonNullable<Awaited<ReturnType<typeof getDossier>>>;

export type Decision =
  | { decision: "APPROVED"; checklist: Record<string, boolean>; note?: string }
  | { decision: "REJECTED"; reason: string; checklist?: Record<string, boolean> };

/**
 * Record an administrator's decision on a professional application. Approving grants the role they registered for
 * and activates the account; rejecting asks the applicant to fix specific things and resubmit.
 */
export async function decideVerification(admin: { id: string; role: "ADMIN" }, userId: string, input: Decision, req?: Request) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, accountType: true, doctorProfile: { select: { id: true, verificationStatus: true } }, labStaffProfile: { select: { id: true, verificationStatus: true } } },
  });
  if (!user || (!user.doctorProfile && !user.labStaffProfile)) throw notFound("Application not found");
  if (user.id === admin.id) throw badRequest("You cannot review your own application");

  const type: ApplicantType = user.doctorProfile ? "DOCTOR" : "FACILITY";
  const current = (user.doctorProfile ?? user.labStaffProfile)!.verificationStatus;
  if (current === "VERIFIED") throw conflict("This account is already verified");

  const docs = await prisma.verificationDocument.findMany({ where: { userId }, select: { kind: true } });

  if (input.decision === "APPROVED") {
    const unchecked = CHECKLISTS[type].filter((c) => input.checklist[c.key] !== true);
    if (unchecked.length > 0) throw badRequest("Confirm every verification check before approving");
    const have = new Set(docs.map((d) => d.kind));
    const missingDocs = REQUIRED_KINDS[type].filter((k) => !have.has(k));
    if (missingDocs.length > 0) throw badRequest(`Required documents are missing: ${missingDocs.map((k) => DOCUMENT_KINDS[k].label).join(", ")}`);
  } else if (input.reason.trim().length < 10) {
    throw badRequest("Explain what the applicant needs to fix (at least 10 characters)");
  }

  const role = type === "DOCTOR" ? ("DOCTOR" as const) : ("LAB_SCIENTIST" as const);
  const approved = input.decision === "APPROVED";

  await prisma.$transaction(async (tx) => {
    const data: Prisma.DoctorProfileUpdateManyMutationInput = approved
      ? { verificationStatus: "VERIFIED", verifiedAt: new Date() }
      : { verificationStatus: "REJECTED" };
    const where = { userId, verificationStatus: { in: ["PENDING", "REJECTED"] as ("PENDING" | "REJECTED")[] } };
    const changed =
      type === "DOCTOR"
        ? await tx.doctorProfile.updateMany({ where, data: { ...data, ...(approved ? { verifiedById: admin.id } : {}) } })
        : await tx.labStaffProfile.updateMany({ where, data: { ...data, ...(approved ? { verifiedById: admin.id } : {}) } });
    if (changed.count === 0) throw conflict("This application was already decided by someone else");

    if (approved) await tx.user.update({ where: { id: userId }, data: { role, status: "ACTIVE", statusReason: null, statusChangedAt: new Date() } });

    await tx.verificationReview.create({
      data: {
        userId,
        reviewerId: admin.id,
        decision: input.decision,
        reason: approved ? input.note?.trim() || null : input.reason.trim(),
        checklist: (approved ? input.checklist : input.checklist ?? {}) as Prisma.InputJsonValue,
      },
    });
  });

  queueNotification(userId, approved ? { kind: "VERIFICATION_APPROVED" } : { kind: "VERIFICATION_REJECTED" }, { anyStatus: true });
  await writeAudit({
    userId: admin.id,
    actorRole: "ADMIN",
    action: approved ? "ADMIN_VERIFICATION_APPROVED" : "ADMIN_VERIFICATION_REJECTED",
    resourceType: "User",
    resourceId: userId,
    details: input.decision === "REJECTED" ? { reason: input.reason } : { checklist: input.checklist },
    req,
  });
  return { status: approved ? ("VERIFIED" as const) : ("REJECTED" as const) };
}
