import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "imedtalk@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Power@Password2026";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if already authenticated (cookie check)
    if (body.check) {
      const authCookie = req.cookies.get("admin_auth");
      if (authCookie?.value === "true") {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Login attempt
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const response = NextResponse.json({ success: true });
      response.cookies.set("admin_auth", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
      });
      response.cookies.set("admin_email", email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: "Invalid credentials. Access denied." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
