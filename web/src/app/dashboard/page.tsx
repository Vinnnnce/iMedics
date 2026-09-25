import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Upload, Calendar, Brain, FileText } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your care, labs, and consultations</p>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border neon-glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Upload Results</CardTitle>
                <CardDescription className="text-xs">Upload lab results for AI analysis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/documents">
              <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Upload Now</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Upcoming Appointments</CardTitle>
                <CardDescription className="text-xs">2 scheduled this week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Dr. Anna Schmidt</p>
              <p className="text-xs text-muted-foreground">Sep 16, 2026 — 10:00 AM</p>
            </div>
            <Link href="/appointments">
              <Button size="sm" variant="outline" className="w-full">View All</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">AI Lab Summary</CardTitle>
                <CardDescription className="text-xs">Latest AI analysis ready</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">CBC Results — Sep 14</p>
              <p className="text-xs text-muted-foreground mt-1">Some values outside typical range. Discuss with your doctor.</p>
            </div>
            <Link href="/documents">
              <Button size="sm" variant="ghost" className="w-full mt-2">View Details</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">CBC Results uploaded</p>
              <p className="text-xs text-muted-foreground">Sep 14, 2026 — AI analysis complete</p>
            </div>
            <Link href="/documents">
              <Button size="sm" variant="outline">View</Button>
            </Link>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Appointment booked</p>
              <p className="text-xs text-muted-foreground">Sep 14, 2026 — Dr. Anna Schmidt</p>
            </div>
            <Link href="/appointments">
              <Button size="sm" variant="outline">View</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
