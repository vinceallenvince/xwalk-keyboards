"use client";

import { useEffect, useRef, useState } from "react";

import { expandPolygonY, processPolygon, simplifyPolygon } from "@/lib/polygon-utils";
import { REALTIME_CALIBRATION, type Boundaries, type Point, type Stripe } from "@/lib/realtime-calibration";
import { isRenderableSegment, noteForSlot } from "@/lib/realtime-scale";

export type CalibrationStatus = "ok" | "degraded" | "no_crosswalk" | "feed_down" | "needs_review";

export type LiveCalibration = {
  status: CalibrationStatus;
  reasoning: string | null;
  boundaries: Boundaries;
  stripes: readonly Stripe[];
  updatedAt: string | null;
  source: "live" | "reference";
};

type CalibrationResponse = {
  status: CalibrationStatus;
  reasoning?: string;
  updatedAt?: string;
  // The agent's newer schema publishes boundaries keyed by segment name; the
  // flattened left/right fields are the published aliases it still writes.
  // Prefer the map when present so extra crosswalks survive the trip.
  crosswalks?: Record<string, number[][]>;
  leftCrosswalk?: number[][];
  rightCrosswalk?: number[][];
  stripes?: Array<{
    stripeIndex: number;
    segment: string;
    // The calibration agent is camera-agnostic: it reports where a stripe sits
    // on the crosswalk and leaves the musical reading to us. `note` is only
    // present on calibrations published before that split, and `visible` only
    // on those that padded the list with undetected stripes.
    note?: string;
    visible?: boolean;
    polygon: number[][];
  }>;
};

// Re-exported so the scale has one import site across the app.
export { noteForSlot };

const REFETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function toStripes(raw: CalibrationResponse["stripes"]): readonly Stripe[] {
  if (!raw?.length) return REALTIME_CALIBRATION.stripes;

  return raw
    .filter((s) => {
      // Newer calibrations only carry stripes that were actually detected, so
      // an absent `visible` means visible — not filtered out.
      if (s.visible === false) return false;
      return isRenderableSegment(s.segment) && s.polygon?.length >= 3;
    })
    .map((s) => ({
      stripeIndex: s.stripeIndex,
      segment: s.segment,
      note: s.note ?? noteForSlot(s.segment, s.stripeIndex),
      // Simplify the jagged instance-segmentation outlines into clean quads,
      // then expand ~15% so a fast-walking pedestrian stepping slightly off
      // the paint still triggers the note.
      polygon: processPolygon(s.polygon.map(([x, y]) => [x, y] as const)),
    }));
}

/**
 * Build a crosswalk boundary that is guaranteed to enclose all the stripes in
 * that segment, then expand vertically. The agent's boundary detection can
 * return a polygon tighter than the actual crosswalk when edge stripes are
 * faded or partially occluded — in that case the stripeForPoint fallback
 * ("foot-point is inside the boundary → assign to nearest stripe") misses
 * people on the outermost bars.
 */
function toBoundary(
  raw: number[][] | undefined,
  stripes: readonly Stripe[],
): readonly Point[] | null {
  // Collect all points from the boundary AND every stripe polygon in this
  // segment into one point cloud, then take the convex hull. This guarantees
  // the boundary covers every stripe.
  const allPoints: Point[] = [];

  if (raw?.length) {
    for (const [x, y] of raw) allPoints.push([x, y] as const);
  }
  for (const stripe of stripes) {
    for (const point of stripe.polygon) allPoints.push(point);
  }

  if (allPoints.length < 3) return null;

  return expandPolygonY(simplifyPolygon(allPoints), 1.2);
}

/** The agent's boundary polygons keyed by segment, from either schema shape. */
function rawBoundaries(data: CalibrationResponse): Record<string, number[][]> {
  if (data.crosswalks) return data.crosswalks;

  const record: Record<string, number[][]> = {};
  if (data.leftCrosswalk?.length) record.left = data.leftCrosswalk;
  if (data.rightCrosswalk?.length) record.right = data.rightCrosswalk;
  return record;
}

/**
 * One boundary per renderable segment that has any geometry this calibration —
 * hulled with its stripes via toBoundary, falling back to the reference
 * boundary for segments the payload left out.
 */
export function toBoundaries(data: CalibrationResponse, stripes: readonly Stripe[]): Boundaries {
  const raw = rawBoundaries(data);
  const segments = new Set([...Object.keys(raw), ...stripes.map((s) => s.segment)]);

  const boundaries: Record<string, readonly Point[]> = {};
  for (const segment of segments) {
    if (!isRenderableSegment(segment)) continue;
    const boundary = toBoundary(raw[segment], stripes.filter((s) => s.segment === segment))
      ?? REFERENCE.boundaries[segment];
    if (boundary) boundaries[segment] = boundary;
  }
  return boundaries;
}

const REFERENCE: LiveCalibration = {
  status: "ok",
  reasoning: null,
  boundaries: REALTIME_CALIBRATION.boundaries,
  stripes: REALTIME_CALIBRATION.stripes,
  updatedAt: null,
  source: "reference",
};

/**
 * Fetch the current calibration from the agent (via the same-origin proxy),
 * falling back to the baked-in reference if the route 404s or errors. Re-fetch
 * every 5 minutes so long-lived sessions pick up drift corrections.
 */
export function useCalibration(cameraId: number): LiveCalibration {
  const [calibration, setCalibration] = useState<LiveCalibration>(REFERENCE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let response = await fetch(`/api/calibration/${cameraId}`, { cache: "no-store" });

        // In local dev the GCS proxy returns 502 (no metadata server for auth).
        // Fall back to a cached snapshot so the live polygons are still usable.
        if (!response.ok) {
          response = await fetch("/calibration-fallback.json", { cache: "no-store" });
        }
        if (!response.ok) return; // keep current (reference or last-known-good)

        const data: CalibrationResponse = await response.json();
        if (cancelled) return;

        const stripes = toStripes(data.stripes);
        if (stripes.length === 0) return; // empty calibration is worse than stale

        setCalibration({
          status: data.status ?? "ok",
          reasoning: data.reasoning ?? null,
          boundaries: toBoundaries(data, stripes),
          stripes,
          updatedAt: data.updatedAt ?? null,
          source: "live",
        });
      } catch {
        // Network error — keep current calibration, try again next interval.
      }
    };

    void load();
    timerRef.current = setInterval(() => void load(), REFETCH_INTERVAL_MS);

    // The RECALIBRATE button dispatches this event after a successful run so
    // the hook picks up the new calibration immediately rather than waiting
    // for the next 5-minute interval.
    const onUpdated = () => void load();
    window.addEventListener("calibration-updated", onUpdated);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("calibration-updated", onUpdated);
    };
  }, [cameraId]);

  return calibration;
}
