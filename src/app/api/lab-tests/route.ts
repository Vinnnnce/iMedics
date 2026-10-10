import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

// GET /api/lab-tests — the catalogue of orderable tests
export const GET = withAuth(null, async () => {
  const tests = await prisma.labTest.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ tests });
});
