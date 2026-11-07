import { SettingsForm } from "@/components/his/settings-form";
import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";

export default async function HospitalSettingsPage() {
  const { facility } = await requireHisPage("MANAGE_HOSPITAL_SETTINGS");
  const s = await prisma.hospitalSettings.findUnique({ where: { facilityId: facility.id }, include: { revisions: { orderBy: { version: "desc" }, take: 10 } } });
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Hospital settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Applies only to {facility.laboratoryName ?? "this facility"}. Every change is versioned{s ? ` (current version ${s.version})` : ""}.</p>
      </div>
      <SettingsForm initial={{
        displayName: s?.displayName ?? facility.laboratoryName ?? "", letterheadLines: (s?.letterheadLines ?? []).join("\n"), logoUrl: s?.logoUrl ?? "", addressLine: s?.addressLine ?? "",
        contactPhone: s?.contactPhone ?? "", contactEmail: s?.contactEmail ?? "", defaultLanguage: s?.defaultLanguage ?? "en", dateFormat: s?.dateFormat ?? "dd/MM/yyyy",
        documentNumberPrefix: s?.documentNumberPrefix ?? "DOC", pageSize: s?.pageSize ?? "A4", footerText: s?.footerText ?? "", enabledModules: s?.enabledModules ?? [],
        triageProtocol: s?.triageProtocol ?? "", triageCategories: (s?.triageCategories ?? []).join(", "), overdueMinutes: s?.overdueMinutes ?? 60,
        independentTemplateApproval: s?.independentTemplateApproval ?? true, defaultRetentionCategory: s?.defaultRetentionCategory ?? "STANDARD", terminology: JSON.stringify(s?.terminology ?? {}),
      }} />
      {s && s.revisions.length > 0 && <section className="rounded-xl border bg-card p-3 text-xs"><h2 className="text-sm font-semibold">Configuration history</h2><ul>{s.revisions.map((r) => <li key={r.version}>v{r.version} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</li>)}</ul></section>}
    </div>
  );
}
