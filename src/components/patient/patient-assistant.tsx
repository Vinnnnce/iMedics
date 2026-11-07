"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass } from "@/components/his/use-api";

interface ReleasedDocument {
  id: string;
  documentNumber: string;
  title: string;
  groupCode: string;
  finalizedAt: string | null;
}

type Mode = "EXPLAIN" | "QUESTIONS" | "FAQ";

interface ExplainResult {
  mode: "EXPLAIN";
  explanation: string;
  keyTerms: string[];
  followUpQuestions: string[];
  aiGenerated: boolean;
  disclaimer: string;
}

interface QuestionsResult {
  mode: "QUESTIONS";
  questions: string[];
  aiGenerated: boolean;
  disclaimer: string;
}

interface FaqResult {
  mode: "FAQ";
  answers: { q: string; a: string }[];
}

type AssistantResult = ExplainResult | QuestionsResult | FaqResult;

/**
 * The patient's AI health assistant. Three modes:
 * - EXPLAIN a released document in plain language (AI, labelled)
 * - prepare QUESTIONS for the doctor (AI, labelled)
 * - portal FAQ (deterministic, no AI)
 *
 * The assistant never diagnoses, prescribes or replaces emergency services.
 */
export function PatientAssistant() {
  const [mode, setMode] = useState<Mode>("QUESTIONS");
  const [documents, setDocuments] = useState<ReleasedDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await api<{ documents: ReleasedDocument[] }>("/api/patient/clinical-documents");
      setDocuments(data.documents);
      if (data.documents[0]) setDocumentId(data.documents[0].id);
    } catch {
      // document list is only needed for EXPLAIN mode; ignore load errors
    }
  }, []);

  useEffect(() => { const t = setTimeout(() => void loadDocuments(), 0); return () => clearTimeout(t); }, [loadDocuments]);

  const ask = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { mode };
      if (mode === "EXPLAIN" && documentId) body.documentId = documentId;
      if (mode === "QUESTIONS") body.topic = topic;
      const data = await api<AssistantResult>("/api/patient/assistant", { method: "POST", body });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl" data-testid="card-patient-assistant">
      <CardHeader>
        <CardTitle className="text-base">Health assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Get your released documents explained in plain language, or prepare questions for your next visit. This
          assistant cannot diagnose, prescribe, or replace emergency services — in an emergency, call your local
          emergency number.
        </p>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Assistant mode">
          {([["QUESTIONS", "Prepare questions"], ["EXPLAIN", "Explain a document"], ["FAQ", "Portal help"]] as const).map(([k, label]) => (
            <Button key={k} size="sm" role="tab" aria-selected={mode === k} variant={mode === k ? "default" : "outline"} onClick={() => { setMode(k); setResult(null); setError(null); }} data-testid={`tab-assistant-${k.toLowerCase()}`}>{label}</Button>
          ))}
        </div>

        {mode === "EXPLAIN" && (
          <label className="block text-xs">
            Document
            <select className={inputClass} value={documentId} onChange={(e) => setDocumentId(e.target.value)} data-testid="select-assistant-document">
              {documents.length === 0 ? <option value="">No released documents yet</option> : documents.map((d) => (
                <option key={d.id} value={d.id}>{d.title} ({d.documentNumber})</option>
              ))}
            </select>
          </label>
        )}

        {mode === "QUESTIONS" && (
          <label className="block text-xs">
            What would you like to ask your doctor about?
            <input className={inputClass} value={topic} placeholder="e.g. my recent blood test results" onChange={(e) => setTopic(e.target.value)} data-testid="input-assistant-topic" />
          </label>
        )}

        {error && <p role="alert" className="text-sm text-destructive" data-testid="text-assistant-error">{error}</p>}

        {mode !== "FAQ" && (
          <Button size="sm" disabled={busy || (mode === "QUESTIONS" && topic.trim().length < 3) || (mode === "EXPLAIN" && !documentId)} onClick={ask} data-testid="button-assistant-ask">
            {busy ? "Working…" : mode === "EXPLAIN" ? "Explain document" : "Suggest questions"}
          </Button>
        )}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm" data-testid="text-assistant-result">
            {result.mode === "EXPLAIN" && (
              <div className="space-y-2">
                <p className="whitespace-pre-line" data-testid="text-assistant-explanation">{result.explanation}</p>
                {result.keyTerms.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Key terms</p>
                    <ul className="list-disc pl-4 text-xs">{result.keyTerms.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  </div>
                )}
                {result.followUpQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">You might ask</p>
                    <ul className="list-disc pl-4 text-xs">{result.followUpQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{result.aiGenerated ? "AI-generated. " : ""}{result.disclaimer}</p>
              </div>
            )}
            {result.mode === "QUESTIONS" && (
              <div className="space-y-2">
                <ol className="list-decimal pl-4">{result.questions.map((q, i) => <li key={i} data-testid={`text-assistant-question-${i}`}>{q}</li>)}</ol>
                <p className="text-xs text-muted-foreground">{result.aiGenerated ? "AI-generated. " : ""}{result.disclaimer}</p>
              </div>
            )}
            {result.mode === "FAQ" && (
              <div className="space-y-2">
                {result.answers.map((a) => (
                  <div key={a.q}>
                    <p className="font-medium">{a.q}</p>
                    <p className="text-xs text-muted-foreground">{a.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
