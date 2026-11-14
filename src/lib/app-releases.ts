// App release management — powers the public download centre and the
// administrator release dashboard. Installation packages are stored in
// object storage (S3/R2) or referenced from GitHub Release assets — never
// in the database itself; the database keeps only metadata + counters.
import { prisma } from "./prisma";
import type { AppRelease } from "@prisma/client";

export const RELEASE_PLATFORMS = ["ANDROID", "IOS", "WINDOWS"] as const;
export type ReleasePlatform = (typeof RELEASE_PLATFORMS)[number];

export const PLATFORM_META: Record<ReleasePlatform, {
  label: string;
  /** Human name for the installer artifact */
  artifact: string;
  defaultMinOs: string;
  storeLabel: string;
}> = {
  ANDROID: { label: "Android", artifact: "APK installer", defaultMinOs: "8.0", storeLabel: "Google Play (AAB)" },
  IOS: { label: "iOS", artifact: "App Store build", defaultMinOs: "15.0", storeLabel: "App Store" },
  WINDOWS: { label: "Windows", artifact: "EXE installer", defaultMinOs: "10", storeLabel: "Windows desktop" },
};

export function isReleasePlatform(value: string): value is ReleasePlatform {
  return (RELEASE_PLATFORMS as readonly string[]).includes(value);
}

/** The current published release for each platform, for the download centre. */
export async function getCurrentReleases(): Promise<Record<ReleasePlatform, AppRelease | null>> {
  const releases = await prisma.appRelease.findMany({
    where: { published: true, isCurrent: true },
    orderBy: { releaseDate: "desc" },
  });
  const out: Record<ReleasePlatform, AppRelease | null> = { ANDROID: null, IOS: null, WINDOWS: null };
  for (const r of releases) {
    if (isReleasePlatform(r.platform) && !out[r.platform]) out[r.platform] = r;
  }
  return out;
}

/** Format bytes for the download cards. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export type PlatformCard = {
  platform: ReleasePlatform;
  meta: (typeof PLATFORM_META)[ReleasePlatform];
  release: AppRelease | null;
};

export function buildPlatformCards(releases: Record<ReleasePlatform, AppRelease | null>): PlatformCard[] {
  return RELEASE_PLATFORMS.map((platform) => ({ platform, meta: PLATFORM_META[platform], release: releases[platform] }));
}

/** Map a Tauri updater target (e.g. "windows-x86_64") to a release platform. */
export function getPlatformLabel(target: string): ReleasePlatform | null {
  if (target.startsWith("windows")) return "WINDOWS";
  if (target.startsWith("android")) return "ANDROID";
  if (target.startsWith("ios") || target.startsWith("darwin")) return "IOS";
  return null;
}
