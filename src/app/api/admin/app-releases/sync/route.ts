// CI sync endpoint: the GitHub Actions release workflow calls this after
// publishing a GitHub Release, so the download centre always points at the
// real, verified build artifacts. Guarded by the RELEASE_SYNC_TOKEN secret —
// the same value is stored as a GitHub Actions secret and compared in
// constant time.
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { isReleasePlatform } from "@/lib/app-releases";

type Asset = { name: string; size?: number; browser_download_url: string };
type GhRelease = { tag_name?: string; name?: string; body?: string; assets?: Asset[] };

const PLATFORM_BY_ASSET: [RegExp, "ANDROID" | "IOS" | "WINDOWS"][] = [
  [/\.apk$/i, "ANDROID"],
  [/\.aab$/i, "ANDROID"],
  [/\.ipa$/i, "IOS"],
  [/\.exe$/i, "WINDOWS"],
  [/\.msi$/i, "WINDOWS"],
];

function platformForAsset(name: string) {
  for (const [re, platform] of PLATFORM_BY_ASSET) if (re.test(name)) return platform;
  return null;
}

/** Expected asset names per platform (see .github/workflows/release.yml). */
const VERSION_RE = /v?(\d+\.\d+\.\d+)/;

export async function POST(req: NextRequest) {
  const token = process.env.RELEASE_SYNC_TOKEN;
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !provided || token.length !== provided.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(provided))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as GhRelease | null;
  if (!payload || !payload.tag_name || !Array.isArray(payload.assets)) {
    return NextResponse.json({ error: "Expected { tag_name, assets } payload" }, { status: 400 });
  }

  const versionMatch = payload.tag_name.match(VERSION_RE);
  const version = versionMatch ? versionMatch[1] : payload.tag_name.replace(/^v/, "");
  const notes = payload.body || "";
  const created: string[] = [];

  for (const asset of payload.assets) {
    const platform = platformForAsset(asset.name);
    if (!platform) continue;
    const isCurrent = true;
    await prisma.appRelease.updateMany({ where: { platform, isCurrent: true }, data: { isCurrent: false } });
    const release = await prisma.appRelease.upsert({
      where: { id: `${platform.toLowerCase()}-${payload.tag_name}` },
      update: {
        version, fileUrl: asset.browser_download_url, fileName: asset.name,
        fileSizeBytes: asset.size ?? null, releaseNotes: notes,
        published: true, isCurrent, releaseDate: new Date(),
      },
      create: {
        id: `${platform.toLowerCase()}-${payload.tag_name}`,
        platform, version, fileUrl: asset.browser_download_url, fileName: asset.name,
        fileSizeBytes: asset.size ?? null, releaseNotes: notes,
        published: true, isCurrent, releaseDate: new Date(),
      },
    });
    created.push(`${platform} ${release.version} (${asset.name})`);
  }

  return NextResponse.json({ ok: true, synced: created });
}
