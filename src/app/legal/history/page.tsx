import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PolicyHistory() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const history = await prisma.policyReceipt.findMany({ where: { userId: user.id }, include: { snapshot: true }, orderBy: { recordedAt: "desc" } });
  return <article className="policy-layout space-y-6"><h1 className="text-2xl font-semibold">My policy history</h1>
    <p className="text-sm text-muted-foreground">These receipts belong only to your account. Draft acknowledgements are not acceptances of a published legal agreement.</p>
    {user.termsVersion && <p className="text-sm">Legacy registration record: {user.termsVersion}, {user.termsAcceptedAt?.toISOString() ?? "date unavailable"}. Exact historical text was not captured by the older implementation; no reconstructed text is presented as your accepted version.</p>}
    {history.length === 0 && <p>No versioned policy receipts have been recorded for this account.</p>}
    {history.map(item => <details key={item.id} className="rounded-xl border border-border p-5">
      <summary className="cursor-pointer text-sm">{item.version} · {item.kind} · {item.accountType} · {item.recordedAt.toISOString()}</summary>
      <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(item.snapshot.content, null, 2)}</pre>
    </details>)}
    <Link className="text-sm underline" href="/legal/privacy">Read current policies</Link>
  </article>;
}
