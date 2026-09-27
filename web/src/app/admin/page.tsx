"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated via cookie
    fetch("/api/admin-auth", { method: "POST", body: JSON.stringify({ check: true }) })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          router.push("/admin/dashboard");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        router.push("/admin/dashboard");
      } else {
        setError(data.error || "Invalid credentials. Access denied.");
        setLoading(false);
      }
    } catch {
      setError("Authentication failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#D0D0D0] bg-white p-8 shadow-sm">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111111]">
              <svg viewBox="0 0 32 32" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 2L4 8v8c0 6 4.5 11 12 14 7.5-3 12-8 12-14V8L16 2z" />
                <path d="M16 8v8M12 12h8" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#111111]">Medic1905 Admin</h1>
            <p className="mt-1 text-sm text-[#555555]">Restricted access — authorized personnel only</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@medic1905.com"
                required
                data-testid="input-admin-email"
                className="w-full rounded-lg border border-[#D0D0D0] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111111] outline-none transition-colors focus:border-[#111111] focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="input-admin-password"
                className="w-full rounded-lg border border-[#D0D0D0] bg-[#FAFAFA] px-4 py-3 text-sm text-[#111111] outline-none transition-colors focus:border-[#111111] focus:bg-white"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="button-admin-login"
              className="w-full rounded-lg bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#333333] disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to Admin Panel"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#888888]">
            Medic1905 — Telemedicine platform serving Nigeria.
            <br />
            Unauthorized access is prohibited and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
