"use client";
import Link from "next/link";
import { FlaskConical, Image, FileText, AlertTriangle, CheckCircle2, TrendingUp, ChevronRight, Activity, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/shared/stat-tile";

export default function DiagnosticsOverview() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 left-20 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative">
          <Badge variant="neon" className="mb-2">Diagnostics Hub</Badge>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold">Diagnostics Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive view of lab results, imaging, and clinical notes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={FlaskConical} label="Lab Results" value="12" accent="teal" subtitle="3 abnormal" />
        <StatTile icon={Image} label="Imaging Studies" value="5" accent="purple" subtitle="2 pending" />
        <StatTile icon={FileText} label="Clinical Notes" value="18" accent="yellow" subtitle="3 new" />
        <StatTile icon={AlertTriangle} label="Needs Attention" value="4" accent="orange" subtitle="1 urgent" />
      </div>

      {/* Recent Lab Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-secondary" /> Recent Lab Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Complete Blood Count", date: "Sep 20", status: "normal", abnormal: 0 },
            { name: "Lipid Panel", date: "Sep 18", status: "abnormal", abnormal: 2 },
            { name: "Thyroid Function Test", date: "Sep 10", status: "normal", abnormal: 0 },
            { name: "Liver Function Test", date: "Sep 5", status: "attention", abnormal: 1 },
          ].map((item, i) => (
            <Link key={i} href="/diagnostics/1">
              <div className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4 hover:bg-muted transition-colors cursor-pointer">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.status === "normal" ? "bg-green-500/10 text-green-400" : item.status === "abnormal" ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"}`}>
                  {item.status === "normal" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
                {item.abnormal > 0 && (
                  <Badge variant={item.status === "attention" ? "warning" : "destructive"}>
                    {item.abnormal} abnormal
                  </Badge>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Imaging Studies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-purple-400" /> Imaging Studies
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Chest X-Ray", date: "Sep 15", status: "reported", finding: "No acute findings" },
            { name: "Abdominal Ultrasound", date: "Sep 8", status: "pending", finding: "Awaiting report" },
            { name: "CT Head", date: "Aug 28", status: "reported", finding: "Normal study" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                <Image className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.date} · {item.finding}</p>
              </div>
              <Badge variant={item.status === "reported" ? "success" : "warning"}>{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Clinical Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Clinical Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { title: "Assessment Note", author: "Dr. Sarah Chen", date: "Sep 20", type: "assessment" },
            { title: "Progress Note", author: "Dr. James Park", date: "Sep 15", type: "progress" },
            { title: "Plan Note", author: "Dr. Sarah Chen", date: "Sep 10", type: "plan" },
          ].map((note, i) => (
            <div key={i} className="rounded-2xl bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-sm">{note.title}</p>
                <Badge variant="outline">{note.type}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{note.author} · {note.date}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Summary Banner */}
      <Card className="overflow-hidden border-primary/20">
        <div className="relative bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl neon-gradient animate-glow-pulse">
              <Brain className="h-7 w-7 text-navy" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold">AI Diagnostic Summary</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Kimi K3 generates a comprehensive summary of all diagnostic findings for quick review.
              </p>
            </div>
            <Link href="/diagnostics/1">
              <Button variant="neon">View Summary</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
