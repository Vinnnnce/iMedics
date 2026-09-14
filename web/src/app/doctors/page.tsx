import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

const DOCTORS = [
  { id: 1, name: "Dr. Anna Schmidt", specialty: "General Practitioner", rating: 4.8, reviews: 127, availability: "Available Today" },
  { id: 2, name: "Dr. Marcus Weber", specialty: "Cardiologist", rating: 4.9, reviews: 89, availability: "Available Tomorrow" },
  { id: 3, name: "Dr. Elena Fischer", specialty: "Dermatologist", rating: 4.7, reviews: 203, availability: "Available Today" },
  { id: 4, name: "Dr. Thomas Klein", specialty: "Pediatrician", rating: 4.9, reviews: 156, availability: "Next Week" },
];

export default function DoctorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find a Doctor</h1>
        <p className="text-sm text-muted-foreground mt-1">Book consultations with verified professionals</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DOCTORS.map((doc) => (
          <Card key={doc.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {doc.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{doc.name}</h3>
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      {doc.availability}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{doc.specialty}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      <span className="text-sm font-medium">{doc.rating}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({doc.reviews} reviews)</span>
                  </div>
                  <Button size="sm" className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow">
                    Book Consultation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
