// Medic1905 Virtual Hospital — simulator API mount point.
// All simulator endpoints live under /api/sim/* and are handled by the
// ported router in src/lib/simulator/router.ts.
import { NextRequest, NextResponse } from "next/server";
import { handleSim } from "@/lib/simulator/router";

type Ctx = { params: Promise<{ path: string[] }> };

async function run(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleSim(req, path ?? []);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: Ctx) { return run(req, ctx); }
export async function POST(req: NextRequest, ctx: Ctx) { return run(req, ctx); }
export async function PUT(req: NextRequest, ctx: Ctx) { return run(req, ctx); }
