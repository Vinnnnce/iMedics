"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Shield, AlertTriangle, Lock, Zap } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold">Settings</h1>
        <p className="text-muted-foreground mt-1">Platform configuration and AI settings</p>
      </div>

      {/* AI Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" /> AI Configuration
            <Badge variant="neon">Kimi K3</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Model: Kimi K3</p>
                <p className="text-xs text-muted-foreground">Moonshot AI — Medical history analysis</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/50 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-sm">API Key Status</p>
                <p className="text-xs text-muted-foreground">Configured via environment variable</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Constraints */}
      <Card className="border-orange-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-400" /> AI Safety Constraints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            "No diagnosis — AI does not provide medical diagnoses",
            "No prescriptions — AI does not recommend specific medications",
            "No emergency instructions — AI does not provide emergency medical guidance",
            "All outputs clearly labeled as assistive only",
            "Clinical correlation is always required",
          ].map((constraint, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-orange-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm">{constraint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform Info */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Information</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">Version</p>
            <p className="font-bold">Medic1905 v1.0.0</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">Framework</p>
            <p className="font-bold">Next.js + Tailwind + shadcn/ui</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">Database</p>
            <p className="font-bold">Neon (PostgreSQL)</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-bold uppercase text-muted-foreground">Hosting</p>
            <p className="font-bold">Vercel</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
