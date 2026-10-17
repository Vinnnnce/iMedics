"use client";

import { useMemo, useState } from "react";
import { Calendar, Download, ExternalLink, Link2, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { formatClinicDateTime } from "@/lib/format";
import { PORTFOLIO_TYPE_LABELS, type PortfolioType } from "@/lib/doctor-profile";

/** Copy the profile link to the clipboard; toast feedback only, nothing is transmitted. */
export function ShareProfileButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-lg"
      onClick={() => {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => toast.success("Profile link copied"))
          .catch(() => toast.error("Could not copy the link"));
      }}
    >
      <Link2 className="mr-1 h-4 w-4" /> Share profile
    </Button>
  );
}

/** Fetches a short-lived, permission-checked download link for the doctor's published CV. */
export function DownloadCvButton({ doctorId }: { doctorId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-lg"
      disabled={pending}
      onClick={() => {
        setPending(true);
        apiClient
          .get<{ url: string }>(`/doctors/${doctorId}/cv`)
          .then((data) => window.open(data.url, "_blank", "noopener"))
          .catch(() => toast.error("The CV could not be downloaded"))
          .finally(() => setPending(false));
      }}
    >
      <Download className="mr-1 h-4 w-4" /> Download CV
    </Button>
  );
}

export type PublicPortfolioItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  attachmentFileId: string | null;
};

/** Portfolio with a type filter; long descriptions expand on demand. */
export function PortfolioSection({ items }: { items: PublicPortfolioItem[] }) {
  const types = useMemo(() => [...new Set(items.map((i) => i.type))], [items]);
  const [filter, setFilter] = useState<string>("ALL");
  const visible = filter === "ALL" ? items : items.filter((i) => i.type === filter);

  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Portfolio</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`rounded-lg border px-3 py-1 text-xs ${filter === "ALL" ? "border-foreground bg-foreground text-background" : "border-input"}`}
        >
          All
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(type)}
            className={`rounded-lg border px-3 py-1 text-xs ${filter === type ? "border-foreground bg-foreground text-background" : "border-input"}`}
          >
            {PORTFOLIO_TYPE_LABELS[type as PortfolioType] ?? type}
          </button>
        ))}
      </div>
      {visible.map((item) => (
        <Card key={item.id} className="beeline-card">
          <CardContent className="space-y-1 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              <Badge variant="outline" className="rounded-lg text-xs">
                {PORTFOLIO_TYPE_LABELS[item.type as PortfolioType] ?? item.type}
              </Badge>
            </div>
            {item.description && <p className="text-muted-foreground">{item.description}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {item.publishedAt && <span>{new Date(item.publishedAt).getFullYear()}</span>}
              {item.externalUrl && (
                <a className="flex items-center gap-1 underline underline-offset-2" href={item.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" /> View
                </a>
              )}
              {item.attachmentFileId && (
                <button
                  type="button"
                  className="flex items-center gap-1 underline underline-offset-2"
                  onClick={() =>
                    apiClient
                      .get<{ url: string }>(`/doctor-files/${item.attachmentFileId}`)
                      .then((data) => window.open(data.url, "_blank", "noopener"))
                      .catch(() => toast.error("The attachment could not be downloaded"))
                  }
                >
                  <Download className="h-3 w-3" /> Attachment
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: string;
  doctorResponse: string | null;
  doctorRespondedAt: string | null;
};

/** Reviews with sorting; patient identity is limited to a first name, as before. */
export function ReviewsSection({
  reviews,
  categories,
}: {
  reviews: PublicReview[];
  categories: Record<string, { avg: number; count: number } | null>;
}) {
  const [sort, setSort] = useState("recent");
  const sorted = useMemo(() => {
    const copy = [...reviews];
    if (sort === "highest") copy.sort((a, b) => b.rating - a.rating);
    else if (sort === "lowest") copy.sort((a, b) => a.rating - b.rating);
    return copy;
  }, [reviews, sort]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Reviews</h2>
        <select
          aria-label="Sort reviews"
          className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Most recent</option>
          <option value="highest">Highest rating</option>
          <option value="lowest">Lowest rating</option>
        </select>
      </div>
      {Object.entries(categories).some(([, v]) => v) && (
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {Object.entries(categories).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-input p-2">
              <p className="capitalize text-muted-foreground">{key}</p>
              {value ? (
                <p className="flex items-center gap-1 font-medium">
                  <Star className="h-3 w-3 fill-current" /> {value.avg} <span className="text-muted-foreground">({value.count})</span>
                </p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </div>
          ))}
        </div>
      )}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
      {sorted.map((r) => (
        <Card key={r.id} className="beeline-card">
          <CardContent className="space-y-1 p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{r.author}</p>
              <span className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3 fill-current" /> {r.rating}/5
              </span>
            </div>
            {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
            <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
            {r.doctorResponse && (
              <div className="rounded-lg bg-muted p-2 text-xs">
                <p className="font-medium">Doctor&rsquo;s response</p>
                <p className="text-muted-foreground">{r.doctorResponse}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

/** Shows the doctor's real next bookable slot in clinic time (WAT), or that none is published. */
export function NextAvailable({ iso }: { iso: string | null }) {
  if (!iso) return <p className="text-sm text-muted-foreground">No published availability</p>;
  return (
    <p className="flex items-center gap-1 text-sm">
      <Calendar className="h-4 w-4" />
      Next available: {formatClinicDateTime(iso)}
    </p>
  );
}
