import { prisma } from "./prisma";

export async function getLaboratoryProfile(userId: string) {
  return await prisma.labStaffProfile.findUnique({
    where: { userId },
  });
}
