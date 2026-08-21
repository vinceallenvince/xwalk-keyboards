"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveCameraRecord } from "@/data/cameras";
import { expandPolygonY, processPolygon, simplifyPolygon } from "@/lib/polygon-utils";
import type { Boundaries, FrameSize, Point, Stripe } from "@/lib/realtime-calibration";
import { compareSegments, noteForOrdinal } from "@/lib/realtime-scale";

export type CalibrationStatus = "ok" | "degraded" | "no_crosswalk" | "feed_down" | "needs_review";

export type LiveCalibration = {
  status: CalibrationStatus;
  reasoning: string | null;
  boundaries: Boundaries;
  /** The frame the polygons were measured in — geometry scales from here. */
  referenceFrame: FrameSize;
  stripes: readonly Stripe[];
  updatedAt: string | null;
  source: "live" | "reference";
};

/**
 * Apply a calibration response directly, bypassing the GCS fetch. Used by the
 * RECALIBRATE button to update the debug panel immediately after the agent
 * publishes, rather than waiting for a GCS round-trip (which may not work
 * locally and adds latency even in production).
 */
export type CalibrationUpdater = (data: CalibrationResponse) => void;

type CalibrationResponse = {
  status: CalibrationStatus;
  reasoning?: string;
  updatedAt?: string;
  /** The raw agent response uses createdAt; the GCS publish rewrites it as updatedAt. */
  createdAt?: string;
  /** The frame the agent measured this calibration's polygons in. */
  referenceFrame?: { width: number; height: number };
  // The agent's newer schema publishes boundaries keyed by segment name; the
  // flattened left/right fields are the published aliases it still writes.
  // Prefer the map when present so extra crosswalks survive the trip.
  crosswalks?: Record<string, number[][]>;
  leftCrosswalk?: number[][];
  rightCrosswalk?: number[][];
  // The calibration agent is camera-agnostic: it reports where a stripe sits
  // on the crosswalk (stripeIndex, 0-based per segment) and leaves the musical
  // reading entirely to us. Earlier schemas also carried `note` and `visible`;
  // both are retired — every published calibration is now note-free and only
  // lists stripes that were actually detected.
  stripes?: Array<{
    stripeIndex: number;
    segment: string;
    polygon: number[][];
  }>;
};

// Re-exported so the scale has one import site across the app.
export { noteForOrdinal };

const REFETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Turn a published calibration's stripes into the playable keyboard.
 *
 * The crossing is numbered as one continuous run: clusters in positional order,
 * stripes by their ordinal within each cluster, notes counted globally from the
 * camera's base anchor. Nothing is filtered by cluster name — the agent's
 * cluster count varies run to run, so there is no fixed vocabulary to check
 * against, and a name we did not expect must still play rather than fall silent.
 *
 * Because the ordinal is global, a cluster splitting in two (a truck parked
 * mid-crosswalk) leaves every note exactly where it was.
 */
export function toStripes(
  camera: LiveCameraRecord,
  raw: CalibrationResponse["stripes"],
): readonly Stripe[] {
  if (!raw?.length) return camera.calibration.stripes;

  const bySegment = new Map<string, NonNullable<CalibrationResponse["stripes"]>>();
  for (const stripe of raw) {
    if (!(stripe.polygon?.length >= 3)) continue;
    const group = bySegment.get(stripe.segment);
    if (group) group.push(stripe);
    else bySegment.set(stripe.segment, [stripe]);
  }

  const stripes: Stripe[] = [];
  for (const segment of [...bySegment.keys()].sort(compareSegments)) {
    const group = [...bySegment.get(segment)!].sort((a, b) => a.stripeIndex - b.stripeIndex);
    for (const s of group) {
      stripes.push({
        stripeIndex: s.stripeIndex,
        segment: s.segment,
        // stripes.length is the running global ordinal across all clusters.
        note: noteForOrdinal(camera.baseAnchor, stripes.length),
        // Simplify the jagged instance-segmentation outlines into clean quads,
        // then expand ~15% so a fast-walking pedestrian stepping slightly off
        // the paint still triggers the note.
        polygon: processPolygon(s.polygon.map(([x, y]) => [x, y] as const)),
      });
    }
  }
  return stripes;
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
 * One hit-region per cluster that has any geometry this calibration.
 *
 * The agent no longer detects or publishes crosswalk boundaries, so in practice
 * each region is a hull of that cluster's own stripes (see toBoundary), which
 * still catches a pedestrian stepping just off the paint. Published boundaries
 * are still honoured when present, for calibrations written before the switch.
 *
 * Hulling per cluster rather than over the whole crossing is what keeps the
 * median unplayable: the gap between two crosswalk runs falls outside every
 * hull, so nobody standing on the island is assigned to a stripe.
 */
export function toBoundaries(
  data: CalibrationResponse,
  stripes: readonly Stripe[],
): Boundaries {
  const raw = rawBoundaries(data);
  const segments = new Set([...Object.keys(raw), ...stripes.map((s) => s.segment)]);

  const boundaries: Record<string, readonly Point[]> = {};
  for (const segment of segments) {
    const boundary = toBoundary(raw[segment], stripes.filter((s) => s.segment === segment));
    if (boundary) boundaries[segment] = boundary;
  }
  return boundaries;
}

/** The calibration shown before (or instead of) any live publish. */
export function referenceCalibrationFor(camera: LiveCameraRecord): LiveCalibration {
  return {
    status: "ok",
    reasoning: null,
    boundaries: camera.calibration.boundaries,
    referenceFrame: camera.calibration.referenceFrame,
    stripes: camera.calibration.stripes,
    updatedAt: null,
    source: "reference",
  };
}

/**
 * Fetch the current calibration from the agent (via the same-origin proxy),
 * falling back to the baked-in reference if the route 404s or errors. Re-fetch
 * every 5 minutes so long-lived sessions pick up drift corrections.
 */
export function useCalibration(camera: LiveCameraRecord): {
  calibration: LiveCalibration;
  applyCalibration: CalibrationUpdater;
} {
  const [calibration, setCalibration] = useState<LiveCalibration>(() => referenceCalibrationFor(camera));
  const [calibratedCamera, setCalibratedCamera] = useState(camera);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref to the current camera so applyCalibration never goes stale.
  // Written from an effect rather than during render (react-hooks/refs):
  // applyCalibration only runs from event handlers and async continuations,
  // all of which fire after effects, so no caller can see a stale camera.
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Derived-state reset: if the same hook instance is ever pointed at a new
  // camera, drop the previous camera's geometry immediately rather than
  // playing it until the new fetch lands.
  if (calibratedCamera !== camera) {
    setCalibratedCamera(camera);
    setCalibration(referenceCalibrationFor(camera));
  }

  /**
   * Apply a CalibrationResponse directly to state, skipping GCS. The
   * RECALIBRATE button calls this with the agent's response so the debug
   * panel updates instantly — no round-trip through GCS, which also fails
   * in local dev (no metadata server for auth).
   */
  const applyCalibration: CalibrationUpdater = useCallback((data: CalibrationResponse) => {
    const cam = cameraRef.current;
    const stripes = toStripes(cam, data.stripes);
    if (stripes.length === 0) return;

    const boundaries = toBoundaries(data, stripes);
    if (Object.keys(boundaries).length === 0) return;

    setCalibration({
      status: data.status ?? "ok",
      reasoning: data.reasoning ?? null,
      boundaries,
      referenceFrame: data.referenceFrame ?? cam.calibration.referenceFrame,
      stripes,
      updatedAt: data.updatedAt ?? data.createdAt ?? null,
      source: "live",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let response = await fetch(`/api/calibration/${camera.cameraId}`, { cache: "no-store" });

        // In local dev the GCS proxy returns 502 (no metadata server for auth).
        // Fall back to a cached snapshot so the live polygons are still usable.
        if (!response.ok) {
          response = await fetch(`/calibration-fallback-${camera.cameraId}.json`, { cache: "no-store" });
        }
        if (!response.ok) return; // keep current (reference or last-known-good)

        const data: CalibrationResponse = await response.json();
        if (cancelled) return;

        applyCalibration(data);
      } catch {
        // Network error — keep current calibration, try again next interval.
      }
    };

    void load();
    timerRef.current = setInterval(() => void load(), REFETCH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [applyCalibration, camera]);

  return { calibration, applyCalibration };
}
