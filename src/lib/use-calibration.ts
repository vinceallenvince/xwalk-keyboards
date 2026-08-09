"use client";

import { useEffect, useRef, useState } from "react";

import { expandPolygonY, processPolygon, simplifyPolygon } from "@/lib/polygon-utils";
import { REALTIME_CALIBRATION, type Point, type Stripe } from "@/lib/realtime-calibration";

export type CalibrationStatus = "ok" | "degraded" | "no_crosswalk" | "feed_down" | "needs_review";

export type LiveCalibration = {
  status: CalibrationStatus;
  reasoning: string | null;
  leftCrosswalk: readonly Point[] | null;
  rightCrosswalk: readonly Point[] | null;
  stripes: readonly Stripe[];
  updatedAt: string | null;
  source: "live" | "reference";
};

type CalibrationResponse = {
  status: CalibrationStatus;
  reasoning?: string;
  updatedAt?: string;
  leftCrosswalk?: number[][];
  rightCrosswalk?: number[][];
  stripes?: Array<{
    stripeIndex: number;
    segment: "left" | "right";
    note: string;
    visible: boolean;
    polygon: number[][];
  }>;
};

const REFETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function toStripes(raw: CalibrationResponse["stripes"]): readonly Stripe[] {
  if (!raw?.length) return REALTIME_CALIBRATION.stripes;

  return raw
    .filter((s) => s.visible && s.polygon?.length >= 3)
    .map((s) => ({
      stripeIndex: s.stripeIndex,
      segment: s.segment,
      note: s.note,
      // Simplify the jagged instance-segmentation outlines into clean quads,
      // then expand ~15% so a fast-walking pedestrian stepping slightly off
      // the paint still triggers the note.
      polygon: processPolygon(s.polygon.map(([x, y]) => [x, y] as const)),
    }));
}

function toPolygon(raw: number[][] | undefined): readonly Point[] | null {
  if (!raw?.length) return null;
  const points = raw.map(([x, y]) => [x, y] as const);
  // Simplify the jagged segmentation outline, then expand only vertically —
  // the crosswalk boundary should be wider top-to-bottom (to catch people
  // stepping just off the edge) but not wider left-to-right (to avoid
  // bleeding into the median or the road).
  return expandPolygonY(simplifyPolygon(points), 1.2);
}

const REFERENCE: LiveCalibration = {
  status: "ok",
  reasoning: null,
  leftCrosswalk: REALTIME_CALIBRATION.leftCrosswalk.map(([x, y]) => [x, y] as const),
  rightCrosswalk: REALTIME_CALIBRATION.rightCrosswalk.map(([x, y]) => [x, y] as const),
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
          leftCrosswalk: toPolygon(data.leftCrosswalk) ?? REFERENCE.leftCrosswalk,
          rightCrosswalk: toPolygon(data.rightCrosswalk) ?? REFERENCE.rightCrosswalk,
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
