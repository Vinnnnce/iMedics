import { NextResponse } from "next/server";
import { runCredentialMonitoring } from "@/lib/services/credential-monitor";

// Cron job endpoint for credential monitoring
// Trigger via: GET /api/cron/credential-monitoring?token=SECRET_CRON_TOKEN
export async function GET(req: Request) {
  try {
    // Verify cron token for security
    const token = new URL(req.url).searchParams.get("token");
    const cronToken = process.env.CRON_SECRET_TOKEN;

    if (!cronToken || token !== cronToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await runCredentialMonitoring();

    return NextResponse.json({
      success: true,
      message: "Credential monitoring completed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Monitoring failed", message: String(error) },
      { status: 500 }
    );
  }
}
