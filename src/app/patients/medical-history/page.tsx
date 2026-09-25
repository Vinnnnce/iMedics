"use client";
import { useState } from "react";
import { Brain, Send, Clock, AlertTriangle, Activity, Heart, Shield, Pill, Plane, Briefcase, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function MedicalHistoryPage() {
  const [complaint, setComplaint] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [pastHistory, setPastHistory] = useState("");
  const [smoking, setSmoking] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [activity, setActivity] = useState("");
  const [painScale, setPainScale] = useState(3);
  const [sleep, setSleep] = useState("");
  const [diabetes, setDiabetes] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [heartAttack, setHeartAttack] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiOutput, setAiOutput] = useState<{ clinician: string; patient: string; questions: string[] } | null>(null);

  const symptomFields = [
    { key: "onset", label: "Onset" },
    { key: "worsening", label: "Worsening Time" },
    { key: "relief", label: "Relief Time" },
    { key: "character", label: "Character" },
  ];

  const handleGenerateAI = async () => {
    setAiGenerating(true);
    // Simulate AI processing — in production this calls the Kimi K3 API
    await new Promise((r) => setTimeout(r, 2500));
    setAiOutput({
      clinician: `CLINICIAN SUMMARY: Patient presents with ${complaint || "unspecified complaint"}. Current medications: ${currentMedications || "none reported"}. Known allergies: ${allergies || "none reported"}. Past medical history is significant for: ${[diabetes && "diabetes", stroke && "stroke", heartAttack && "heart attack"].filter(Boolean).join(", ") || "no major chronic conditions"}. Family history: ${familyHistory || "not significant"}. Lifestyle: ${smoking || "non-smoker"}, ${alcohol || "no alcohol use"}, ${activity || "moderate activity"}. Pain scale: ${painScale}/10. Sleep: ${sleep || "normal"}. Risk factors: ${painScale > 6 ? "High pain levels warrant further investigation. " : ""}${smoking === "current" ? "Active smoking is a significant cardiovascular risk factor. " : ""}Recommend clinical correlation and appropriate workup.`,
      patient: `Hello! Based on the information you provided, here's a summary of what you've shared: You mentioned ${complaint || "some concerns"}. ${diabetes || stroke || heartAttack ? "You have a history of some chronic conditions, so it's important to monitor your health regularly. " : "Your overall health profile looks good. "}Remember to keep taking your medications as prescribed${currentMedications ? ` (${currentMedications})` : ""} and follow up with your doctor for personalized advice.`,
      questions: [
        "Can you describe the onset of your symptoms — was it sudden or gradual?",
        "What makes the symptoms better or worse?",
        "Have you noticed any patterns in your symptoms throughout the day?",
        "Are there any activities that trigger or relieve your symptoms?",
        "Have you recently traveled or been exposed to any illnesses?",
      ],
    });
    setAiGenerating(false);
  };

  const progress = ((complaint ? 1 : 0) + (currentMedications ? 1 : 0) + (allergies ? 1 : 0) + (pastHistory ? 1 : 0) + (smoking ? 1 : 0) + (activity ? 1 : 0)) / 6 * 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-light p-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <Badge variant="neon" className="mb-2">Medical History</Badge>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold">Complete Medical History</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in the form below. Our AI assistant will generate a structured summary.</p>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Completion</span>
              <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="form" className="flex-1">Medical Form</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">AI Summary</TabsTrigger>
        </TabsList>

        {/* Form Tab */}
        <TabsContent value="form" className="space-y-4">
          {/* Complaint & Symptoms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> Complaint & Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Chief Complaint</Label>
                <Textarea
                  placeholder="Describe the main reason for your visit..."
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {symptomFields.map((field) => (
                  <div key={field.key}>
                    <Label className="mb-2 block">{field.label}</Label>
                    <Input placeholder={`Enter ${field.label.toLowerCase()}`} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Medication & Allergies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-secondary" /> Medications & Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Current Medications</Label>
                <Textarea
                  placeholder="List all medications you're currently taking..."
                  value={currentMedications}
                  onChange={(e) => setCurrentMedications(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 block">Allergies</Label>
                <Textarea
                  placeholder="List any allergies (medications, food, environmental)..."
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Medical History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" /> Medical History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <ToggleCard label="Diabetes" icon={Heart} value={diabetes} onChange={setDiabetes} />
                <ToggleCard label="Stroke" icon={Activity} value={stroke} onChange={setStroke} />
                <ToggleCard label="Heart Attack" icon={Heart} value={heartAttack} onChange={setHeartAttack} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Family History</Label>
                  <Textarea
                    placeholder="Any hereditary conditions in your family..."
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Past Medical History</Label>
                  <Textarea
                    placeholder="Previous diagnoses, surgeries, hospitalizations..."
                    value={pastHistory}
                    onChange={(e) => setPastHistory(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lifestyle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-secondary" /> Lifestyle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <SelectField label="Smoking Status" value={smoking} onChange={setSmoking} options={["Never", "Former", "Current"]} />
                <SelectField label="Alcohol Use" value={alcohol} onChange={setAlcohol} options={["Never", "Occasional", "Regular", "Heavy"]} />
                <SelectField label="Activity Level" value={activity} onChange={setActivity} options={["Sedentary", "Light", "Moderate", "Active", "Very Active"]} />
              </div>
              <div>
                <Label className="mb-2 block">Pain Scale: <span className="text-primary font-bold">{painScale}/10</span></Label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={painScale}
                  onChange={(e) => setPainScale(Number(e.target.value))}
                  className="w-full h-3 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #22D3EE 0%, #FFD400 ${painScale * 10}%, hsl(var(--muted)) ${painScale * 10}%)` }}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>No pain</span><span>Moderate</span><span>Severe</span>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Sleep Patterns</Label>
                <Input
                  placeholder="e.g., 7-8 hours, occasional insomnia"
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate AI Summary */}
          <Button variant="neon" size="lg" className="w-full" onClick={handleGenerateAI} disabled={aiGenerating}>
            {aiGenerating ? (
              <>
                <Brain className="mr-2 h-5 w-5 animate-pulse" /> AI is analyzing your history...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-5 w-5" /> Generate AI Summary with Kimi K3
              </>
            )}
          </Button>
        </TabsContent>

        {/* AI Output Tab */}
        <TabsContent value="ai" className="space-y-4">
          {!aiOutput && !aiGenerating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-4">
                  <Brain className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold">AI Summary Not Generated Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Fill in the medical form and click "Generate AI Summary" to get a structured clinician summary, patient recap, and follow-up questions.
                </p>
                <Button variant="neon" className="mt-4" onClick={handleGenerateAI}>
                  <Brain className="mr-2 h-4 w-4" /> Generate Now
                </Button>
              </CardContent>
            </Card>
          )}

          {aiGenerating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl neon-gradient animate-glow-pulse mb-4">
                  <Brain className="h-10 w-10 text-navy animate-pulse" />
                </div>
                <h3 className="font-display text-lg font-bold">AI is processing your data...</h3>
                <p className="text-sm text-muted-foreground mt-1">Kimi K3 is analyzing your medical history</p>
              </CardContent>
            </Card>
          )}

          {aiOutput && (
            <>
              {/* Clinician Summary */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Brain className="h-4 w-4" />
                    </div>
                    Clinician Summary
                    <Badge variant="neon">AI-Generated</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{aiOutput.clinician}</p>
                </CardContent>
              </Card>

              {/* Patient Recap */}
              <Card className="border-secondary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                      <Heart className="h-4 w-4" />
                    </div>
                    Patient-Friendly Recap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{aiOutput.patient}</p>
                </CardContent>
              </Card>

              {/* Follow-up Questions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-400" /> Suggested Follow-Up Questions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {aiOutput.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {i + 1}
                      </div>
                      <p className="text-sm">{q}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Safety Notice */}
              <div className="flex items-start gap-3 rounded-2xl bg-orange-500/10 p-4">
                <Shield className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This AI-generated summary is assistive only and does not constitute a medical diagnosis, prescription, or emergency instruction. Always consult with a qualified healthcare professional.
                </p>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleCard({ label, icon: Icon, value, onChange }: { label: string; icon: any; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center justify-between rounded-2xl border-2 p-4 transition-all", value ? "border-primary bg-primary/5" : "border-border bg-muted/30")}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", value ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt.toLowerCase()}>{opt}</option>
        ))}
      </select>
    </div>
  );
}
