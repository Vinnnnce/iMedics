import { redirect } from "next/navigation";

// Document templates moved inside Case reports → Documents (as the "Templates" tab).
// Keep this route working for bookmarks and in-app links.
export default function FacilityDocumentTemplatesRedirect() {
  redirect("/lab/case-reports?tab=templates");
}
