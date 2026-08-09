"use client";

import { useEffect, useRef, useState } from "react";

import { REALTIME_CALIBRATION, type Stripe } from "@/lib/realtime-calibration";

export type CalibrationStatus = "ok" | "degraded" | "no_crosswalk" | "feed_down" | "needs_review";

export type LiveCalibration = {
  status: CalibrationStatus;
  reasoning: string | null;
  stripes: readonly Stripe[];
  updatedAt: string | null;
  source: "live" | "reference";
};

type CalibrationResponse = {
  status: CalibrationStatus;
  reasoning?: string;
  updatedAt?: string;
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
      polygon: s.polygon.map(([x, y]) => [x, y] as const),
    }));
}

const REFERENCE: LiveCalibration = {
  status: "ok",
  reasoning: null,
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
        const response = await fetch(`/api/calibration/${cameraId}`, { cache: "no-store" });
        if (!response.ok) return; // keep current (reference or last-known-good)

        const data: CalibrationResponse = await response.json();
        if (cancelled) return;

        const stripes = toStripes(data.stripes);
        if (stripes.length === 0) return; // empty calibration is worse than stale

        setCalibration({
          status: data.status ?? "ok",
          reasoning: data.reasoning ?? null,
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

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cameraId]);

  return calibration;
}
