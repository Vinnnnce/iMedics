import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain, FileText, TrendingUp } from "lucide-react";

export default function DoctorAiToolsPage() {
  const tools = [
    { title: "AI Diagnosis Assistant", desc: "Get AI-powered differential diagnosis suggestions based on symptoms", icon: Brain, enabled: true },
    { title: "Lab Result Analysis", desc: "AI interpretation of lab results with abnormality detection", icon: TrendingUp, enabled: true },
    { title: "Consultation Summary", desc: "Auto-generate patient-friendly summaries from clinical notes", icon: FileText, enabled: true },
    { title: "Drug Interaction Checker", desc: "Check for potential drug interactions in prescriptions", icon: Sparkles, enabled: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Consultation Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered tools for clinical decision support</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-accent-teal/30 bg-accent-teal/5 p-4">
        <Sparkles className="h-5 w-5 text-accent-teal shrink-0" />
        <p className="text-xs text-muted-foreground">
          AI tools are for informational purposes only. Doctors remain responsible for all clinical decisions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.title} className="beeline-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tool.enabled ? "bg-accent-teal/10" : "bg-muted"}`}>
                    <Icon className={`h-6 w-6 ${tool.enabled ? "text-accent-teal" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{tool.title}</p>
                      <Badge variant={tool.enabled ? "secondary" : "outline"} className={tool.enabled ? "bg-accent-teal/10 text-accent-teal rounded-lg" : "rounded-lg"}>
                        {tool.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
                    <Button size="sm" variant="outline" className="mt-2 rounded-xl">
                      {tool.enabled ? "Open" : "Enable"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
