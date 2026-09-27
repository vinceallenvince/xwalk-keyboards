"use client";

import { useEffect, useState } from "react";

import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";

export type CameraLink = {
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
 * The link shown when there is nothing better to offer: the default camera,
 * whose feed already plays behind the homepage. Used when the statuses can't
 * be fetched and when every feed is down.
 */
export function defaultCameraLinks(statuses: CameraLink[] = []): CameraLink[] {
  const known = statuses.find((camera) => camera.cameraId === DEFAULT_LIVE_CAMERA.cameraId);
  return [known ?? { cameraId: DEFAULT_LIVE_CAMERA.cameraId, status: "unknown", crosswalkRank: DEFAULT_RANK }];
}

/** Keep unavailable feeds out of navigation, even if their old calibration is usable. */
export function selectableCameraLinks(statuses: CameraLink[]): CameraLink[] {
  const available = statuses.filter((camera) => camera.status !== "feed_down");
  const sorted = [...available].sort(byRankThenId);
  const withCrosswalks = sorted.filter((camera) => camera.status !== "no_crosswalk");

  // If every available camera is rotated, keep those cameras visible so the
  // visitor still has somewhere to go. A feed_down camera is never restored,
  // except that when every feed is down the default camera stands in.
  if (withCrosswalks.length > 0) return withCrosswalks;
  if (sorted.length > 0) return sorted;
  return defaultCameraLinks(statuses);
}

/**
 * Fetch calibration statuses for all live cameras and compute which ones
 * should appear as links on the homepage. Cameras with `no_crosswalk` are
 * excluded unless ALL cameras are rotated (always give the visitor somewhere
 * to go). Links are sorted by `crosswalk_rank` ascending (best first), with
 * ties broken by camera ID descending.
 *
 * No links are returned until availability is known, so the homepage never
 * shows a camera it is about to hide (VIN-82). If the fetch fails, the
 * default camera is the only link.
 *
 * The homepage fetches once on load — no polling. A camera that recovers or
 * rotates while the visitor is on the page is reflected on the next visit or
 * browser refresh.
 */
export function useCameraLinks(): {
  cameras: CameraLink[];
  loading: boolean;
} {
  const [cameras, setCameras] = useState<CameraLink[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let resolved: CameraLink[];
      try {
        const response = await fetch("/api/calibration/status", { cache: "no-store" });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = (await response.json()) as { cameras?: unknown };
        if (!Array.isArray(data.cameras)) throw new Error("malformed status payload");
        resolved = selectableCameraLinks(data.cameras as CameraLink[]);
      } catch {
        resolved = defaultCameraLinks();
      }
      if (!cancelled) setCameras(resolved);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return cameras ? { cameras, loading: false } : { cameras: [], loading: true };
}
