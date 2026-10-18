"use client";

import { useState } from "react";
import { useStoredArray } from "@/hooks/use-stored-array";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2, ListChecks, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { findModule, EMERGENCY_BANNER, GUIDELINE_SOURCE, LAST_REVIEWED } from "@/lib/emergency/content";

const PROGRESS_KEY = "medic1905.emergency.progress";

export function EmergencyModuleView({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const mod = findModule(moduleId);
  const [completed, setCompleted] = useStoredArray(PROGRESS_KEY);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  if (!mod) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-xl font-bold">Module not found</h1>
        <Link href="/emergency" className="text-sm underline">Back to the learning centre</Link>
      </div>
    );
  }

  const allQuizCorrect =
    (mod.quiz ?? []).length > 0 &&
    mod.quiz!.every((q, i) => quizAnswers[i] === q.correctIndex);

  const markComplete = () => {
    const next = [...new Set([...completed, mod.id])];
    setCompleted(next);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/emergency" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Learning centre
        </Link>
        {completed.includes(mod.id) && (
          <Badge className="rounded-lg bg-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Completed</Badge>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{mod.title}</h1>
          <Badge variant="outline" className="rounded-lg">{mod.track === "BLS" ? "Basic life support" : "Advanced (professionals)"}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{mod.summary}</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4" role="alert">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{EMERGENCY_BANNER.body}</p>
      </div>

      {/* Numbered steps */}
      <ol className="space-y-3">
        {mod.steps.map((step, index) => (
          <li key={index}>
            <Card className={`beeline-card ${step.professionalOnly ? "border-dashed" : ""}`}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">{index + 1}</span>
                    {step.title}
                  </h2>
                  {step.professionalOnly && (
                    <Badge variant="outline" className="rounded-lg text-[10px] shrink-0">Healthcare professionals</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{step.body}</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={checkedSteps.includes(index)}
                    onChange={(e) =>
                      setCheckedSteps((prev) => (e.target.checked ? [...prev, index] : prev.filter((i) => i !== index)))
                    }
                  />
                  I have read this step
                </label>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {/* Checklist */}
      {mod.checklist && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mod.checklist.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label={item} />
                <span className="text-muted-foreground">{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quiz */}
      {mod.quiz && mod.quiz.length > 0 && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Knowledge check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {mod.quiz.map((q, qi) => {
              const answered = quizAnswers[qi] !== undefined;
              return (
                <div key={qi} className="space-y-2">
                  <p className="text-sm font-medium">{q.question}</p>
                  <div className="space-y-1">
                    {q.options.map((option, oi) => (
                      <button
                        key={oi}
                        onClick={() => setQuizAnswers((prev) => ({ ...prev, [qi]: oi }))}
                        className={`block w-full rounded-lg border p-2 text-left text-sm transition-colors ${
                          answered && oi === q.correctIndex
                            ? "border-emerald-500 bg-emerald-500/10"
                            : quizAnswers[qi] === oi
                              ? "border-destructive bg-destructive/10"
                              : "border-border hover:bg-muted"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {answered && (
                    <p className="text-xs text-muted-foreground">{q.explanation}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={markComplete} disabled={allQuizCorrect === false && (mod.quiz?.length ?? 0) > 0}>
          Mark this mod as complete
        </Button>
        <Button variant="outline" onClick={() => router.push("/emergency")}>Back to all modules</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Sources: {GUIDELINE_SOURCE}. Last reviewed {LAST_REVIEWED}. Educational content only — not a substitute for certified training or local emergency protocols.
      </p>
    </div>
  );
}
