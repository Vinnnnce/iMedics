import { redirect } from "next/navigation";

// The patient documents feature moved inside Case reports (as its "Documents" tab).
// Keep this route working for bookmarks and in-app links.
export default function DoctorRecordsRedirect() {
  redirect("/doctor/case-reports?tab=documents");
}
