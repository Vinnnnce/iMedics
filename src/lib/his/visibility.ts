import type { Prisma } from "@prisma/client";
import { forbidden } from "@/lib/errors";

/** Apply before pagination/search so restricted metadata is never returned. */
export function documentVisibility(userId: string, canReview: boolean): Prisma.ClinicalDocumentWhereInput {
  return canReview ? {} : { OR: [{ sensitivity: { not: "SPECIALLY_PROTECTED" } }, { authorId: userId }] };
}

export function mediaVisibility(canReview: boolean): Prisma.MedicalMediaWhereInput {
  return canReview ? {} : { sensitivity: { not: "SPECIALLY_PROTECTED" } };
}

export function assertDocumentReadable(
  doc: { sensitivity: string; authorId: string },
  userId: string,
  canReview: boolean,
): void {
  if (doc.sensitivity === "SPECIALLY_PROTECTED" && doc.authorId !== userId && !canReview) {
    throw forbidden("This record is specially protected");
  }
}
