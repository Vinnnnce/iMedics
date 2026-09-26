"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, MessageSquare, Heart, Calendar, Video } from "lucide-react";

export default function DoctorsPage() {
  const [showRating, setShowRating] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const doctors = [
    { id: "1", name: "Dr. Anna Schmidt", specialty: "Cardiology", rating: 4.8, reviews: 124, verified: true, nextSlot: "Sep 30, 10:00 AM" },
    { id: "2", name: "Dr. Mark Johnson", specialty: "General Medicine", rating: 4.6, reviews: 89, verified: true, nextSlot: "Sep 28, 2:00 PM" },
    { id: "3", name: "Dr. Sarah Lee", specialty: "Dermatology", rating: 4.9, reviews: 201, verified: true, nextSlot: "Oct 1, 9:00 AM" },
    { id: "4", name: "Dr. James Wilson", specialty: "Neurology", rating: 4.7, reviews: 56, verified: true, nextSlot: "Sep 29, 11:00 AM" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find Doctors</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse and book appointments with verified doctors</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {doctors.map((doc) => (
          <Card key={doc.id} className="beeline-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-lg">
                  {doc.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{doc.name}</p>
                    {doc.verified && (
                      <span className="flex items-center gap-1 text-xs text-accent-teal">
                        <Star className="h-3 w-3 fill-current" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      <span className="text-xs font-medium">{doc.rating}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({doc.reviews} reviews)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Next available: {doc.nextSlot}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Button size="sm" className="flex-1 bg-primary text-primary-foreground rounded-xl">
                  <Calendar className="h-4 w-4 mr-1" /> Book
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl">
                  <Video className="h-4 w-4 mr-1" /> Consult
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setShowRating(showRating === doc.id ? null : doc.id)}>
                  <Heart className="h-4 w-4" />
                </Button>
              </div>

              {/* Rating Modal */}
              {showRating === doc.id && (
                <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold">Rate & Review Dr. {doc.name.split(" ")[1]}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setRating(star)}>
                        <Star className={`h-6 w-6 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Write your review..."
                    className="rounded-xl"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-primary text-primary-foreground rounded-xl">Submit Review</Button>
                    <Button size="sm" variant="outline" className="rounded-xl">Like</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
