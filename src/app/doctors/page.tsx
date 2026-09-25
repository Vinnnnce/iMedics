"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, MapPin, Star, Clock, Stethoscope, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/shared/star-rating";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const specialties = ["All", "Cardiology", "Neurology", "Pediatrics", "Dermatology", "Orthopedics", "Psychiatry", "General Medicine"];

const doctors = [
  { id: "1", name: "Dr. Sarah Chen", specialty: "Cardiology", experience: 12, rating: 4.9, reviews: 328, location: "Central Clinic", available: true, photo: null },
  { id: "2", name: "Dr. Michael Rodriguez", specialty: "Neurology", experience: 15, rating: 4.8, reviews: 256, location: "Neuro Center", available: true, photo: null },
  { id: "3", name: "Dr. Emily Watson", specialty: "Pediatrics", experience: 8, rating: 4.9, reviews: 412, location: "Children's Hospital", available: false, photo: null },
  { id: "4", name: "Dr. James Park", specialty: "Dermatology", experience: 10, rating: 4.7, reviews: 189, location: "Skin Care Clinic", available: true, photo: null },
  { id: "5", name: "Dr. Anna Kowalski", specialty: "Orthopedics", experience: 20, rating: 5.0, reviews: 567, location: "Sports Med Center", available: true, photo: null },
  { id: "6", name: "Dr. David Kim", specialty: "Psychiatry", experience: 14, rating: 4.8, reviews: 203, location: "Mental Health Hub", available: true, photo: null },
];

export default function DoctorDirectory() {
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = doctors.filter((d) => {
    if (selectedSpecialty !== "All" && d.specialty !== selectedSpecialty) return false;
    if (showAvailableOnly && !d.available) return false;
    if (searchQuery && !d.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Find a Doctor</h1>
        <p className="text-muted-foreground mt-1">Browse our network of specialists and book an appointment</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search by doctor name..."
          className="pl-12 h-14 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Specialty Chips */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {specialties.map((spec) => (
            <button
              key={spec}
              onClick={() => setSelectedSpecialty(spec)}
              className={cn(
                "rounded-2xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap",
                selectedSpecialty === spec
                  ? "bg-primary text-navy neon-glow-yellow"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {spec}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Availability Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAvailableOnly(!showAvailableOnly)}
          className={cn(
            "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-all",
            showAvailableOnly ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"
          )}
        >
          <div className={cn("h-2 w-2 rounded-full", showAvailableOnly ? "bg-secondary" : "bg-muted-foreground")} />
          Available now only
        </button>
        <span className="text-sm text-muted-foreground">{filtered.length} doctors found</span>
      </div>

      {/* Doctor Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((doctor) => (
          <Card key={doctor.id} className="group hover:shadow-neon transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-16 w-16 rounded-3xl">
                    <AvatarImage src={doctor.photo || undefined} />
                    <AvatarFallback className="rounded-3xl text-lg">
                      {doctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  {doctor.available && (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card bg-green-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{doctor.name}</h3>
                      <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    </div>
                    {doctor.available ? (
                      <Badge variant="success">Available</Badge>
                    ) : (
                      <Badge variant="warning">Busy</Badge>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      {doctor.rating}
                    </span>
                    <span>{doctor.experience} yrs exp</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {doctor.location}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-2">
                    <Link href={`/doctors/${doctor.id}`}>
                      <Button variant="outline" size="sm">View Profile</Button>
                    </Link>
                    <Button variant="neon" size="sm">
                      <Calendar className="mr-1 h-4 w-4" /> Book
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
