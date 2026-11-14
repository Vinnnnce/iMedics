import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { ReleaseManager } from "@/components/admin/release-manager";

export const dynamic = "force-dynamic";

export default async function AdminAppReleasesPage() {
  const releases = await prisma.appRelease.findMany({
    orderBy: [{ platform: "asc" }, { releaseDate: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="App releases"
        description="Manage the Medic1905 native application downloads shown in the homepage download centre."
      />
      <ReleaseManager initialReleases={JSON.parse(JSON.stringify(releases))} />
    </>
  );
}
