"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "./use-api";

/**
 * AI-generated executive summary of facility operations (KPIs, ED load, documents, stock, AI usage).
 * Output is clearly labelled as AI-generated and is advisory only.
 */
export function AiAdminSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const data = await api<{ summary: string; generatedAt: string; disclaimers: string[] }>(
        "/api/facility/his/ai/admin",
        { method: "POST" },
      );
      setSummary(data.summary);
      setGeneratedAt(data.generatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl" data-testid="card-ai-admin-summary">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          AI operational summary
          <Button size="sm" variant="outline" disabled={busy} onClick={generate} data-testid="button-generate-ai-summary">
            {busy ? "Generating…" : "Generate"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p role="alert" className="text-sm text-destructive" data-testid="text-ai-summary-error">{error}</p>}
        {summary ? (
          <div className="space-y-2" data-testid="text-ai-summary">
            <p className="whitespace-pre-line text-sm">{summary}</p>
            <p className="text-xs text-muted-foreground">
              AI-generated on {generatedAt ? new Date(generatedAt).toLocaleString() : ""} · advisory only, not a clinical
              document; a qualified professional must review before any action is taken.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Generate an AI-written executive summary of current facility operations (ED load, documents, pharmacy stock,
            nursing tasks, AI usage). Clearly labelled as AI-generated.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
