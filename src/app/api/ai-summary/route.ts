import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST() {
  try {
    await requireUser();

    // AI summary endpoint implementation
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function GET() {
  try {
    await requireUser();

    // AI summary retrieval endpoint
    return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
