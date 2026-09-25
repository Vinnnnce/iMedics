"use client";
import { useState } from "react";
import Link from "next/link";
import { Droplet, TestTube, FlaskConical, QrCode, Image, Search, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const categories = [
  { id: "blood", name: "Blood Tests", icon: Droplet, color: "text-red-400", bgColor: "bg-red-500/10", count: 24 },
  { id: "urine", name: "Urine Tests", icon: TestTube, color: "text-yellow-400", bgColor: "bg-yellow-500/10", count: 12 },
  { id: "stool", name: "Stool Tests", icon: FlaskConical, color: "text-orange-400", bgColor: "bg-orange-500/10", count: 8 },
  { id: "swab", name: "Swab Tests", icon: QrCode, color: "text-teal-400", bgColor: "bg-teal-500/10", count: 15 },
  { id: "imaging", name: "Imaging", icon: Image, color: "text-purple-400", bgColor: "bg-purple-500/10", count: 10 },
];

const tests = [
  { id: "1", name: "Complete Blood Count (CBC)", category: "blood", description: "Measures red and white blood cells, hemoglobin, and platelets.", preparation: "No fasting required. Stay hydrated.", duration: "4-6 hours", price: 25, icon: Droplet },
  { id: "2", name: "Lipid Panel", category: "blood", description: "Measures cholesterol and triglyceride levels in the blood.", preparation: "Fast for 9-12 hours before the test.", duration: "6-8 hours", price: 35, icon: Droplet },
  { id: "3", name: "Comprehensive Metabolic Panel", category: "blood", description: "Checks kidney function, liver function, and electrolyte levels.", preparation: "Fast for 8 hours. No alcohol 24h prior.", duration: "6-8 hours", price: 45, icon: Droplet },
  { id: "4", name: "Urinalysis", category: "urine", description: "Examines the physical and chemical properties of urine.", preparation: "Collect first morning specimen. Clean catch method.", duration: "2-4 hours", price: 20, icon: TestTube },
  { id: "5", name: "Stool Culture", category: "stool", description: "Detects bacteria and parasites in the digestive tract.", preparation: "Avoid antibiotics 72h before collection.", duration: "48-72 hours", price: 30, icon: FlaskConical },
  { id: "6", name: "Throat Swab Culture", category: "swab", description: "Identifies bacterial infections in the throat.", preparation: "No food or drink 2 hours before swab.", duration: "24-48 hours", price: 25, icon: QrCode },
  { id: "7", name: "Chest X-Ray", category: "imaging", description: "Produces images of the heart, lungs, and chest bones.", preparation: "Remove jewelry. Wear loose clothing.", duration: "30 minutes", price: 80, icon: Image },
  { id: "8", name: "Abdominal Ultrasound", category: "imaging", description: "Uses sound waves to create images of abdominal organs.", preparation: "Fast for 8 hours. Full bladder required.", duration: "45 minutes", price: 120, icon: Image },
];

export default function LabTestCatalog() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTests = tests.filter((test) => {
    if (activeCategory !== "all" && test.category !== activeCategory) return false;
    if (searchQuery && !test.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold">Lab Test Catalog</h1>
        <p className="text-muted-foreground mt-1">Browse and order lab tests online</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Search tests..." className="pl-12 h-14 text-base" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {/* Category Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(isActive ? "all" : cat.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-3xl border-2 p-4 transition-all",
                isActive ? "border-primary bg-primary/5 neon-glow-yellow" : "border-border bg-card hover:bg-accent"
              )}
            >
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", cat.bgColor, cat.color)}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold text-center">{cat.name}</span>
              <Badge variant="outline" className="text-[10px]">{cat.count}</Badge>
            </button>
          );
        })}
      </div>

      {/* Test Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredTests.map((test) => {
          const Icon = test.icon;
          return (
            <Card key={test.id} className="group hover:shadow-neon transition-all hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold">{test.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{test.description}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{test.preparation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Results in {test.duration}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-primary">${test.price}</span>
                  <Link href="/lab-tests/order">
                    <Button variant="neon" size="sm">Order Test</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTests.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No tests found matching your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
