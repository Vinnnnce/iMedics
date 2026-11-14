"use client";

// DOWNLOAD MEDIC1905 MEDICAL SIMULATOR — the download centre.
// PUBG-inspired HUD styling: dark tactical panel, angular clipped cards,
// bold uppercase type, amber highlights. Detects the visitor's platform and
// marks it RECOMMENDED, but always shows every platform and never starts a
// download automatically.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Platform = "ANDROID" | "IOS" | "WINDOWS";

type Release = {
  id: string;
  platform: Platform;
  version: string;
  channel: string;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  minOsVersion: string | null;
  releaseNotes: string;
  storeUrl: string | null;
  testFlightUrl: string | null;
  releaseDate: string;
  downloadCount: number;
};

type Releases = { releases: Record<Platform, Release | null> };

function detectPlatform(): Platform | "OTHER" {
  if (typeof navigator === "undefined") return "OTHER";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "IOS";
  if (/Android/i.test(ua)) return "ANDROID";
  if (/Windows/i.test(ua)) return "WINDOWS";
  return "OTHER";
}

function formatBytes(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function AndroidLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993.9993.4482.9993.9993a.9994.9994 0 0 1-.9993.9997m-11.046 0a.9994.9994 0 0 1-.9993-.9997c0-.5511.4482-.9993.9993-.9993s.9993.4482.9993.9993-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 0 0-.1521-.5676.416.416 0 0 0-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0519l-2.0223-3.503a.4161.4161 0 0 0-.5676-.1521.4157.4157 0 0 0-.1521.5676l1.9973 3.4592C3.2909 10.9812 1.2214 14.0993 1 18h22c-.2214-3.9007-2.2909-7.0188-5.1185-8.6786" />
    </svg>
  );
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.86 3.03-.8 1.28.1 2.24.61 2.87 1.53-2.63 1.57-2.2 5.02.43 5.99-.53 1.4-1.21 2.79-2.24 4.15m-4.85-13.6c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25" />
    </svg>
  );
}

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 5.5474 10.643 4.5l.0037 7.4214-7.6418.0434L3 5.5474Zm8.6437-.959L21.9977 3.25l.0014 8.6702-10.3554.082.0006-7.404ZM3 12.1123l7.6414.0608-.0028 7.4239L3 18.5635l.0016-6.4512Zm8.6495.0703 10.3513.0729-.0041 8.6539-10.3443-1.4631-.0029-7.2637Z" />
    </svg>
  );
}

function Crosshair({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CARD_STYLE = "m1905-dl-card";
const BTN_STYLE = "m1905-dl-btn";

export function DownloadCentre({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Releases | null>(null);
  const [platform, setPlatform] = useState<Platform | "OTHER">("OTHER");

  useEffect(() => {
    setPlatform(detectPlatform());
    fetch("/api/app-releases")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  const cards = useMemo(() => {
    const r = data?.releases;
    return [
      {
        key: "android" as const,
        platform: "ANDROID" as Platform,
        title: "ANDROID APP",
        logo: AndroidLogo,
        btn: "DOWNLOAD FOR ANDROID",
        minOsLabel: "Android 8.0+",
        release: r?.ANDROID ?? null,
      },
      {
        key: "ios" as const,
        platform: "IOS" as Platform,
        title: "iOS APP",
        logo: AppleLogo,
        btn: "DOWNLOAD ON THE APP STORE",
        minOsLabel: "iOS 15.0+",
        release: r?.IOS ?? null,
      },
      {
        key: "windows" as const,
        platform: "WINDOWS" as Platform,
        title: "WINDOWS APP",
        logo: WindowsLogo,
        btn: "DOWNLOAD FOR WINDOWS",
        minOsLabel: "Windows 10+ (64-bit)",
        release: r?.WINDOWS ?? null,
      },
    ];
  }, [data]);

  return (
    <section id="download" className="m1905-dl" aria-label="Download Medic1905 Medical Simulator">
      <div className="m1905-dl-inner">
        <header className="m1905-dl-head">
          <Crosshair className="m1905-dl-cross" />
          <h2 className="m1905-dl-title">
            DOWNLOAD MEDIC1905 <span>MEDICAL SIMULATOR</span>
          </h2>
          <p className="m1905-dl-sub">
            One account, every device — the full simulation platform as native apps.
            {platform !== "OTHER" && <> Detected device: <b className="m1905-dl-detected">{platform === "IOS" ? "iPhone / iPad" : platform === "ANDROID" ? "Android" : "Windows"}</b></>}
          </p>
        </header>

        <div className={`m1905-dl-grid ${compact ? "compact" : ""}`}>
          {cards.map(({ key, platform: p, title, logo: Logo, btn, minOsLabel, release }) => {
            const recommended = platform === p;
            const live = release && (release.fileUrl || release.storeUrl);
            const href = live ? `/api/app-releases/download/${release.id}` : null;
            const size = formatBytes(release?.fileSizeBytes ?? null);
            return (
              <article key={key} id={key} className={`${CARD_STYLE}${recommended ? " recommended" : ""}`}>
                {recommended && (
                  <span className="m1905-dl-ribbon" aria-label="Recommended for your device">
                    RECOMMENDED
                  </span>
                )}
                <div className="m1905-dl-card-top">
                  <span className="m1905-dl-logo"><Logo className="h-8 w-8" /></span>
                  <h3 className="m1905-dl-card-title">{title}</h3>
                </div>

                <ul className="m1905-dl-meta">
                  <li><span>Version</span><b>{release?.version ?? "1.0.0"}</b></li>
                  <li><span>Size</span><b>{size ?? (p === "IOS" ? "App Store" : "—")}</b></li>
                  <li><span>Requires</span><b>{release?.minOsVersion ? `${p === "WINDOWS" ? "Windows" : p === "ANDROID" ? "Android" : "iOS"} ${release.minOsVersion}+` : minOsLabel}</b></li>
                  <li><span>Released</span><b>{release ? formatDate(release.releaseDate) : "Coming soon"}</b></li>
                </ul>

                {p === "IOS" && release?.testFlightUrl && (
                  <a className="m1905-dl-tf" href={release.testFlightUrl} target="_blank" rel="noopener noreferrer">
                    Beta available on TestFlight
                  </a>
                )}

                {href ? (
                  <a className={BTN_STYLE} href={href} data-platform={p}>
                    {btn}
                  </a>
                ) : (
                  <span className={`${BTN_STYLE} disabled`} aria-disabled="true">
                    {p === "IOS" ? "APP STORE — PENDING REVIEW" : "BUILD IN PROGRESS"}
                  </span>
                )}

                <span className="m1905-dl-channel">
                  {release?.channel === "beta" ? "BETA CHANNEL" : "STABLE CHANNEL"}
                </span>
              </article>
            );
          })}
        </div>

        <div className="m1905-dl-web">
          <Link href="/simulator/" className="m1905-dl-web-link">
            OPEN WEB SIMULATOR
          </Link>
          <p>No installation required — runs in any modern browser.</p>
        </div>
      </div>
    </section>
  );
}
