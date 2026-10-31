"use client";

import { useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { emergencyGuides, emergencyVideos } from "@/lib/emergency/education";
import { EmergencyIllustration } from "./illustrations";

function EducationVideo({ video }: { video: (typeof emergencyVideos)[number] }) {
  const [active, setActive] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-video overflow-hidden bg-muted">
        {active ? (
          <iframe title={video.title} src={`https://www.youtube-nocookie.com/embed/${video.id}?cc_load_policy=1`} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : (
          <button type="button" className="absolute inset-0 flex w-full items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary" onClick={() => setActive(true)} aria-label={`Load video: ${video.title}`}>
            {!imageFailed && (
              // Official thumbnail endpoint. Dimensions reserve space before loading.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt={`Preview: ${video.title}`} width={480} height={360} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={() => setImageFailed(true)} />
            )}
            <span className="relative flex items-center gap-2 rounded-full bg-background/95 px-4 py-3 text-sm font-semibold text-foreground shadow"><Play className="h-4 w-4" aria-hidden="true" />Load video</span>
          </button>
        )}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-xs font-semibold text-primary">{video.source}</p>
        <h3 className="break-words text-sm font-semibold leading-relaxed">{video.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{video.description}</p>
        <div className="flex flex-wrap gap-3">
          <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Watch on YouTube: ${video.title} (new tab)`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Watch on YouTube<ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /></a>
          {active && <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm underline" onClick={() => setActive(false)}><X className="h-4 w-4" aria-hidden="true" />Close player</button>}
        </div>
        {active && <p role="status" className="text-xs text-muted-foreground">Player blocked, unavailable or not loading? Use Watch on YouTube. No need to wait here.</p>}
      </div>
    </article>
  );
}

export function EmergencyEducation() {
  return (
    <div className="min-w-0 space-y-8">
      <section aria-labelledby="emergency-guides-title">
        <h2 id="emergency-guides-title" className="scroll-mt-24 text-lg font-bold">Illustrated emergency guides</h2>
        <p className="mt-1 text-sm text-muted-foreground">First-aid instructions for public education. Simple illustrations are memory aids, not demonstrations of technique.</p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {emergencyGuides.map((guide) => <article key={guide.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 h-28 overflow-hidden rounded-lg bg-muted/30 p-2"><EmergencyIllustration id={guide.illustration} label={guide.alt} className="h-full w-full text-primary" /></div>
            <h3 className="font-semibold">{guide.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.instructions}</p>
            <a href={guide.source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline">{guide.sourceName} (new tab)</a>
          </article>)}
        </div>
      </section>
      <section aria-labelledby="emergency-videos-title">
        <h2 id="emergency-videos-title" className="scroll-mt-24 text-lg font-bold">Educational videos</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Do not delay emergency help to watch. Some publishers refer to their country&apos;s emergency number; use your local emergency services instead. Videos contact YouTube only when loaded; thumbnails may contact YouTube earlier. Captions are requested where the publisher provides them. The written guides above remain available without video.</p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {emergencyVideos.map((video) => <EducationVideo key={video.id} video={video} />)}
        </div>
      </section>
    </div>
  );
}
