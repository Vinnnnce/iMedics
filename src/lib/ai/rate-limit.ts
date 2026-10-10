import { prisma } from "../prisma";
import { ApiError } from "../errors";

export const AI_REQUEST_ACTION = "AI_ANALYSIS_REQUESTED";

/**
 * Per-user hourly cap on AI requests (cost and abuse control). It counts audit-log
 * entries, so it works across serverless instances without extra infrastructure.
 */
export async function enforceAiRateLimit(userId: string): Promise<void> {
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 30;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const used = await prisma.auditLog.count({
    where: { userId, action: AI_REQUEST_ACTION, createdAt: { gte: since } },
  });
  if (used >= limit) throw new ApiError(429, "AI request limit reached. Please try again later.");
}
