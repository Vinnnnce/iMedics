import { Card, CardContent } from "@/components/ui/card";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("DOCTOR");
  const profile = await getDoctorProfile(user.id);

  if (!profile || profile.verificationStatus !== "VERIFIED") {
    return (
      <Card className="beeline-card mx-auto max-w-md">
        <CardContent className="p-6 text-center">
          <h1 className="text-lg font-semibold">Verification required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your doctor profile has not been verified yet. You will get access to the doctor portal once an
            administrator has reviewed your credentials.
          </p>
        </CardContent>
      </Card>
    );
  }
  return children;
}
