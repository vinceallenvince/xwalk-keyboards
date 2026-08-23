"use client";

import { useEffect, useState } from "react";

import { LIVE_CAMERAS } from "@/data/cameras";

type CameraLink = {
  cameraId: number;
  status: string;
  crosswalkRank: number;
};

/** Default rank when the field is absent (mid-tier). */
const DEFAULT_RANK = 3;

/** Sort by crosswalk_rank ascending (best first), then camera ID descending. */
function byRankThenId(a: CameraLink, b: CameraLink): number {
  return a.crosswalkRank - b.crosswalkRank || b.cameraId - a.cameraId;
}

/**
 * Fetch calibration statuses for all live cameras and compute which ones
 * should appear as links on the homepage. Cameras with `no_crosswalk` are
 * excluded unless ALL cameras are rotated (always give the visitor somewhere
 * to go). Links are sorted by `crosswalk_rank` ascending (best first), with
 * ties broken by camera ID descending.
 *
 * The homepage fetches once on load — no polling. A camera that recovers or
 * rotates while the visitor is on the page is reflected on the next visit or
 * browser refresh.
 */
export function useCameraLinks(): {
  cameras: CameraLink[];
  loading: boolean;
} {
  const [statuses, setStatuses] = useState<CameraLink[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/calibration/status", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { cameras: CameraLink[] };
        if (!cancelled) setStatuses(data.cameras);
      } catch {
        // Network error — keep showing all cameras as fallback.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // While loading or on error, show all cameras with a default rank.
  // Ties broken by camera ID descending — the visitor always has
  // somewhere to go.
  if (!statuses) {
    return {
      cameras: LIVE_CAMERAS.map((c) => ({
        cameraId: c.cameraId,
        status: "ok",
        crosswalkRank: DEFAULT_RANK,
      })).sort(byRankThenId),
      loading: true,
    };
  }

  const sorted = [...statuses].sort(byRankThenId);
  const withCrosswalks = sorted.filter((c) => c.status !== "no_crosswalk");

  // If all cameras are rotated, show all anyway.
  const visible = withCrosswalks.length > 0 ? withCrosswalks : sorted;

  return { cameras: visible, loading: false };
}
