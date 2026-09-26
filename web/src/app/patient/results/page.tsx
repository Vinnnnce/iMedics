import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Download } from "lucide-react";

export default function PatientResultsPage() {
  const results = [
    { id: 1, name: "Complete Blood Count (CBC)", date: "Sep 14, 2026", status: "Verified", lab: "City Lab" },
    { id: 2, name: "Lipid Panel", date: "Sep 10, 2026", status: "Verified", lab: "City Lab" },
    { id: 3, name: "Liver Function Test", date: "Sep 5, 2026", status: "Pending", lab: "Metro Lab" },
    { id: 4, name: "Thyroid Panel (TSH)", date: "Aug 28, 2026", status: "Verified", lab: "City Lab" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analysis Results</h1>
        <p className="text-sm text-muted-foreground mt-1">View your lab test results</p>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <Card key={result.id} className="beeline-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-teal/10">
                  <FlaskConical className="h-5 w-5 text-accent-teal" />
                </div>
                <div>
                  <p className="text-sm font-medium">{result.name}</p>
                  <p className="text-xs text-muted-foreground">{result.date} — {result.lab}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={result.status === "Verified" ? "secondary" : "outline"} className={result.status === "Verified" ? "bg-accent-teal/10 text-accent-teal rounded-lg" : "rounded-lg"}>
                  {result.status}
                </Badge>
                <Button size="sm" variant="outline" className="rounded-xl">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
