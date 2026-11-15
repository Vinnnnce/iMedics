import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FacilityContextPool } from "./db-pool";
import { setDefaultAutoSelectFamily } from "node:net";

// Prisma 7 connects through a driver adapter. DATABASE_URL should be the pooled Neon connection string.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createClient() {
  // Keep Node's address-family fallback enabled so IPv4 is tried when Neon IPv6 is unreachable.
  setDefaultAutoSelectFamily(true);
  const connection = { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 60000 };
  // FACILITY_RLS_CONTEXT=on tells Postgres which facility each request acts for, so the
  // row-level security policies apply. Off by default; see docs/ROW_LEVEL_SECURITY.md.
  const adapter = new PrismaPg(process.env.FACILITY_RLS_CONTEXT === "on" ? new FacilityContextPool(connection) : connection);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
