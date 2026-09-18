"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Activity,
  FileText,
  MessageSquare,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AIAnalysis {
  type: string;
  suggestedQuestions?: string[];
  riskFactors?: string[];
  symptomClusters?: Record<string, string[]>;
  summary?: string;
  hpi?: string;
  recap?: string;
}

interface AIAssistantPanelProps {
  patientId: string;
  historyId?: string;
  chiefComplaint?: string;
  symptoms?: Array<{ name?: string }>;
}

export function AIAssistantPanel({
  patientId,
  historyId,
  chiefComplaint,
  symptoms,
}: AIAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function triggerAI(action: "analyze" | "summary" | "recap") {
    if (!historyId) {
      setError("Please save the history first before triggering AI analysis.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.post<AIAnalysis>(
        `/patients/${patientId}/history/${historyId}/ai`,
        { action }
      );
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="flex h-full flex-col border-l border-border bg-card"
    >
      <CollapsibleTrigger
        className="flex items-center justify-between border-b border-border px-4 py-3"
        data-testid="button-ai-toggle"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Safety Notice */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              AI output is assistive only. Not a diagnosis. All outputs must be
              clinician-reviewed before clinical use.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="default"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => triggerAI("analyze")}
              disabled={loading}
              data-testid="button-ai-analyze"
            >
              <Activity className="h-3.5 w-3.5" />
              Analyze History
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => triggerAI("summary")}
              disabled={loading}
              data-testid="button-ai-summary"
            >
              <FileText className="h-3.5 w-3.5" />
              Generate Summary (HPI)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => triggerAI("recap")}
              disabled={loading}
              data-testid="button-ai-recap"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Patient Recap
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating...
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-4">
              <Separator />

              {/* Suggested Questions */}
              {analysis.suggestedQuestions &&
                analysis.suggestedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Suggested Questions
                      </h3>
                    </div>
                    <ul className="space-y-1.5">
                      {analysis.suggestedQuestions.map((q, i) => (
                        <li
                          key={i}
                          className="rounded-lg bg-muted/50 p-2 text-xs"
                          data-testid={`text-suggested-question-${i}`}
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Risk Factors */}
              {analysis.riskFactors && analysis.riskFactors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Risk Factors
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.riskFactors.map((rf, i) => (
                      <Badge
                        key={i}
                        variant="destructive"
                        className="text-xs"
                        data-testid={`badge-risk-factor-${i}`}
                      >
                        {rf}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Symptom Clusters */}
              {analysis.symptomClusters &&
                Object.keys(analysis.symptomClusters).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Symptom Clusters
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(analysis.symptomClusters).map(
                        ([system, syms]) => (
                          <div
                            key={system}
                            className="rounded-lg border border-border p-2"
                            data-testid={`card-symptom-cluster-${system}`}
                          >
                            <p className="text-xs font-medium">{system}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {syms.map((s, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* HPI Summary */}
              {analysis.hpi && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Structured HPI
                    </h3>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed" data-testid="text-hpi-summary">
                      {analysis.hpi}
                    </pre>
                  </div>
                </div>
              )}

              {/* Patient Recap */}
              {analysis.recap && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Patient Recap
                    </h3>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs leading-relaxed" data-testid="text-patient-recap">
                      {analysis.recap}
                    </p>
                  </div>
                </div>
              )}

              {/* AI Disclaimer */}
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">
                  AI-assisted, clinician-reviewed. This output is informational
                  only and is not a medical diagnosis.
                </p>
              </div>
            </div>
          )}

          {!analysis && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Click "Analyze History" to generate AI-assisted insights from
                the patient's medical history.
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
