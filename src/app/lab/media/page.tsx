import { MediaUploader } from "@/components/his/media-uploader";
import { requireHisPage } from "@/lib/his/page";

export default async function MediaPage() {
  const { can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS");
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Diagnostic media &amp; patient files</h1>
        <p className="mt-1 text-sm text-muted-foreground">Files are validated by real file signature, checksummed, stored privately and served through expiring links. Every view and download is audited.</p>
      </div>
      <MediaUploader canUpload={can("UPLOAD_MEDIA")} canRelease={can("RELEASE_DOCUMENTS")} canReview={can("REVIEW_DOCUMENTS")} />
    </div>
  );
}
