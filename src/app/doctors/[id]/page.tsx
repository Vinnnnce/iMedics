import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Award, Languages, Calendar, MessageSquare, CheckCircle2, GraduationCap, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/shared/star-rating";
import { Separator } from "@/components/ui/separator";

const doctorData = {
  id: "1",
  name: "Dr. Sarah Chen",
  specialty: "Cardiology",
  subSpecialty: "Interventional Cardiology",
  experience: 12,
  rating: 4.9,
  reviewCount: 328,
  location: "Central Clinic, Building A",
  education: "MD, Harvard Medical School | Cardiology Fellowship, Johns Hopkins",
  certifications: ["Board Certified Cardiologist", "FACC", "ABIM Interventional Cardiology"],
  languages: ["English", "Mandarin", "Spanish"],
  photo: null as string | null,
  bio: "Dr. Sarah Chen is a board-certified cardiologist with over 12 years of experience specializing in interventional cardiology. She completed her medical training at Harvard Medical School and her fellowship at Johns Hopkins. Dr. Chen is passionate about preventive cardiology and patient education.",
  expertise: ["Coronary Artery Disease", "Heart Failure", "Arrhythmia", "Hypertension", "Echocardiography", "Cardiac Catheterization"],
  reviews: [
    { name: "John M.", rating: 5.0, comment: "Excellent doctor! Very thorough and caring. Took time to explain everything.", date: "2024-12-01" },
    { name: "Maria L.", rating: 5.0, comment: "Best cardiologist I've ever seen. Highly recommend.", date: "2024-11-15" },
    { name: "Robert K.", rating: 4.5, comment: "Very knowledgeable. Slight wait but worth it.", date: "2024-10-28" },
  ],
  schedule: [
    { day: "Mon", slots: ["09:00", "10:00", "11:00", "14:00", "15:00"] },
    { day: "Tue", slots: ["09:00", "10:00", "14:00", "15:00", "16:00"] },
    { day: "Wed", slots: ["11:00", "14:00", "15:00"] },
    { day: "Thu", slots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"] },
    { day: "Fri", slots: ["09:00", "10:00", "11:00"] },
  ],
};

export default function DoctorProfile({ params }: { params: { id: string } }) {
  const doctor = doctorData; // In production, fetch from DB

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/doctors">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
        </Button>
      </Link>

      {/* Header Card */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-navy to-navy-light p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-10 left-20 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 rounded-3xl border-4 border-primary/20">
              <AvatarImage src={doctor.photo || undefined} />
              <AvatarFallback className="rounded-3xl text-3xl font-bold">
                {doctor.name.split(" ").slice(1).map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="neon">{doctor.experience} years experience</Badge>
                <Badge variant="teal">{doctor.specialty}</Badge>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-extrabold">{doctor.name}</h1>
              <p className="text-muted-foreground mt-1">{doctor.subSpecialty}</p>
              <div className="mt-3 flex items-center gap-4">
                <StarRating rating={doctor.rating} size={20} showValue />
                <span className="text-sm text-muted-foreground">{doctor.reviewCount} reviews</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {doctor.location}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="neon" size="lg">
                  <Calendar className="mr-2 h-5 w-5" /> Book Appointment
                </Button>
                <Button variant="glass" size="lg">
                  <MessageSquare className="mr-2 h-5 w-5" /> Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* About Doctor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{doctor.bio}</p>
          <Separator />
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Education</p>
              <p className="text-sm">{doctor.education}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Languages</p>
              <div className="flex flex-wrap gap-2">
                {doctor.languages.map((lang) => (
                  <Badge key={lang} variant="outline">{lang}</Badge>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Certifications</p>
            <div className="flex flex-wrap gap-2">
              {doctor.certifications.map((cert) => (
                <Badge key={cert} variant="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {cert}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Areas of Expertise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-secondary" /> Areas of Expertise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {doctor.expertise.map((exp) => (
              <span key={exp} className="rounded-2xl bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary">
                {exp}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {doctor.schedule.map((slot) => (
              <div key={slot.day} className="rounded-2xl bg-muted p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2">{slot.day}</p>
                <div className="space-y-1.5">
                  {slot.slots.map((time) => (
                    <button
                      key={time}
                      className="w-full rounded-xl bg-card px-3 py-1.5 text-xs font-bold transition-all hover:bg-primary hover:text-navy"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Reviews ({doctor.reviewCount})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {doctor.reviews.map((review, i) => (
            <div key={i} className="rounded-2xl bg-muted/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                    {review.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{review.name}</p>
                    <StarRating rating={review.rating} size={12} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{review.date}</span>
              </div>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
