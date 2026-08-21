"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { LiveCalibration } from "@/lib/use-calibration";
import type { FrameSize, Stripe } from "@/lib/realtime-calibration";
import { scalePolygon } from "@/lib/realtime-calibration";
import { compareSegments } from "@/lib/realtime-scale";
import type { StartupSummary } from "@/lib/startup-timing";

type RealtimeDebugProps = {
  calibration: LiveCalibration;
  /** Foot-points of all detected pedestrians, in source-frame coordinates. */
  detectionPoints: [number, number][];
  /** The current video frame dimensions, needed to map polygons onto the overlay. */
  frame: FrameSize | null;
  /** Force the camera into the unavailable state for testing. */
  onForceUnavailable: () => void;
  /** Clear a forced unavailable state. */
  onClearUnavailable: () => void;
  /** Whether the unavailable state is currently being forced. */
  forcedUnavailable: boolean;
  /** Force the 5-minute inference pause modal for testing. */
  onForcePause: () => void;
  /** Capture the current frame and run the calibration agent against it. */
  onRecalibrate: () => void;
  /** Whether a recalibration request is in flight. */
  recalibrating: boolean;
  /** The latest startup timing summary, or null before the first attempt completes. */
  startupSummary: StartupSummary | null;
  /** The viewport element the debug canvas should cover. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Debug panel toggled by Ctrl+Shift+D. Invisible in normal use.
 *
 * Shows: status, reasoning, conditions, stripe count, confidence, updatedAt,
 * source (live vs reference).
 *
 * Also provides a RENDER POLYGONS button that draws all stripe outlines over
 * the feed so calibration accuracy can be confirmed visually, and RECALIBRATE
 * to run the calibration agent against the current frame. Recalibration is an
 * operator tool, not part of the study — it lives here rather than in the
 * status bar, where it sat beside copy written for visitors.
 */
function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function RealtimeDebug({ calibration, detectionPoints, frame, onForceUnavailable, onClearUnavailable, forcedUnavailable, onForcePause, onRecalibrate, recalibrating, startupSummary, viewportRef }: RealtimeDebugProps) {
  const [open, setOpen] = useState(false);
  const [showPolygons, setShowPolygons] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Toggle on Ctrl+Shift+D
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Draw all polygons when toggled on
  const drawPolygons = useCallback(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport || !frame || !showPolygons) return;

    const bounds = viewport.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, bounds.width, bounds.height);

    const sourceAspect = frame.width / frame.height;
    const viewportAspect = bounds.width / bounds.height;
    const contentWidth = sourceAspect > viewportAspect ? bounds.width : bounds.height * sourceAspect;
    const contentHeight = sourceAspect > viewportAspect ? bounds.width / sourceAspect : bounds.height;
    const offsetX = (bounds.width - contentWidth) / 2;
    const offsetY = (bounds.height - contentHeight) / 2;
    const scaleX = contentWidth / frame.width;
    const scaleY = contentHeight / frame.height;

    // Crosswalk boundary quads — dashed amber outlines.
    const boundaryColor = "rgba(255, 190, 90, 0.8)";
    for (const boundary of Object.values(calibration.boundaries)) {
      if (boundary.length < 3) continue;
      const scaled = scalePolygon(boundary, calibration.referenceFrame, frame);
      const [first, ...rest] = scaled;
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(offsetX + first[0] * scaleX, offsetY + first[1] * scaleY);
      for (const pt of rest) ctx.lineTo(offsetX + pt[0] * scaleX, offsetY + pt[1] * scaleY);
      ctx.closePath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = boundaryColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Clusters are named by the agent and their count is not fixed, so colours
    // are generated per cluster rather than mapped from a fixed vocabulary —
    // otherwise every cluster past the first two renders the same grey.
    const segmentNames = [...new Set(calibration.stripes.map((s) => s.segment))].sort(compareSegments);
    const colorFor = (segment: string) => {
      const index = segmentNames.indexOf(segment);
      return `hsla(${(150 + index * 70) % 360}, 45%, 71%, 0.7)`;
    };

    for (const stripe of calibration.stripes) {
      const polygon = scalePolygon(stripe.polygon, calibration.referenceFrame, frame);
      const [first, ...rest] = polygon;
      if (!first) continue;

      ctx.beginPath();
      ctx.moveTo(offsetX + first[0] * scaleX, offsetY + first[1] * scaleY);
      for (const pt of rest) ctx.lineTo(offsetX + pt[0] * scaleX, offsetY + pt[1] * scaleY);
      ctx.closePath();
      ctx.strokeStyle = colorFor(stripe.segment);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label with stripeIndex
      const cx = polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length;
      const cy = polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length;
      ctx.font = `${9 * pixelRatio / pixelRatio}px monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(stripe.stripeIndex), offsetX + cx * scaleX, offsetY + cy * scaleY);
    }

    // Draw a circle at each pedestrian foot-point.
    const dotRadius = 2 * scaleX;
    for (const [px, py] of detectionPoints) {
      const dx = offsetX + px * scaleX;
      const dy = offsetY + py * scaleY;
      ctx.beginPath();
      ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 90, 90, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [calibration.boundaries, calibration.referenceFrame, calibration.stripes, detectionPoints, frame, showPolygons, viewportRef]);

  useEffect(() => {
    if (!showPolygons) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    drawPolygons();
    const observer = new ResizeObserver(drawPolygons);
    const viewport = viewportRef.current;
    if (viewport) observer.observe(viewport);
    return () => observer.disconnect();
  }, [drawPolygons, showPolygons, viewportRef]);

  if (!open) {
    return showPolygons ? (
      <canvas ref={canvasRef} className="realtime-debug-canvas" aria-hidden="true" />
    ) : null;
  }

  const { stripes } = calibration;
  const visible = stripes.filter((s) => "visible" in s ? (s as Stripe & { visible?: boolean }).visible !== false : true);

  // Stripe count per cluster, in the same positional order the keyboard is
  // numbered in — so a cluster splitting mid-run is visible as it happens.
  const clusterCounts = new Map<string, number>();
  for (const stripe of stripes) clusterCounts.set(stripe.segment, (clusterCounts.get(stripe.segment) ?? 0) + 1);
  const clusters = [...clusterCounts.entries()].sort(([a], [b]) => compareSegments(a, b));
  // The agent stopped publishing boundaries; a hull with more points than the
  // four a stripe-derived quad carries means this calibration predates that.
  const publishedBoundaries = Object.values(calibration.boundaries).some((b) => b.length > 4);

  return (
    <>
      {showPolygons && <canvas ref={canvasRef} className="realtime-debug-canvas" aria-hidden="true" />}
      <div className="realtime-debug-panel" role="dialog" aria-label="Calibration debug">
        <div className="realtime-debug-header">
          <span>CALIBRATION DEBUG</span>
          <button type="button" onClick={() => setOpen(false)}>✕</button>
        </div>
        <dl className="realtime-debug-data">
          <dt>source</dt>
          <dd className={calibration.source === "live" ? "realtime-debug-live" : ""}>{calibration.source}</dd>
          <dt>status</dt>
          <dd>{calibration.status}</dd>
          <dt>reasoning</dt>
          <dd>{calibration.reasoning ?? "—"}</dd>
          <dt>updatedAt</dt>
          <dd>{calibration.updatedAt ? new Date(calibration.updatedAt).toLocaleString() : "—"}</dd>
          <dt>stripes</dt>
          <dd>{visible.length} / {stripes.length}</dd>
          <dt>clusters</dt>
          <dd>{clusters.length ? clusters.map(([name, count]) => `${name}(${count})`).join(" ") : "—"}</dd>
          <dt>keyboard</dt>
          <dd>{stripes.length ? `${stripes[0].note} → ${stripes[stripes.length - 1].note}` : "—"}</dd>
          {Object.entries(calibration.boundaries).map(([segment, boundary]) => (
            <Fragment key={segment}>
              <dt>{segment} hull</dt>
              <dd>{boundary.length} pts{publishedBoundaries ? "" : " (synthesized)"}</dd>
            </Fragment>
          ))}
          <dt>frame</dt>
          <dd>{frame ? `${frame.width}×${frame.height}` : "—"}</dd>
        </dl>
        {startupSummary && (
          <>
            <div className="realtime-debug-header">
              <span>STARTUP TIMING</span>
            </div>
            <dl className="realtime-debug-data">
              <dt>outcome</dt>
              <dd className={startupSummary.outcome === "success" ? "realtime-debug-live" : ""}>{startupSummary.outcome}</dd>
              <dt>type</dt>
              <dd>{startupSummary.sessionType}</dd>
              <dt>key / retry</dt>
              <dd>{startupSummary.connectionKey} / {startupSummary.retryCount}</dd>
              <dt>reached</dt>
              <dd>{startupSummary.reachedStage}</dd>
              <dt>→ GPU ready</dt>
              <dd>{formatMs(startupSummary.timeToGpuReady)}</dd>
              <dt>→ predictions</dt>
              <dd>{formatMs(startupSummary.timeToPredictions)}</dd>
              <dt>prediction lag</dt>
              <dd>{formatMs(startupSummary.predictionLag)}</dd>
              <dt>perceived</dt>
              <dd>{formatMs(startupSummary.perceivedLatency)}</dd>
            </dl>
          </>
        )}
        <div className="realtime-debug-actions">
          <button
            type="button"
            className={`realtime-debug-toggle${showPolygons ? " realtime-debug-toggle--active" : ""}`}
            onClick={() => setShowPolygons((prev) => !prev)}
          >
            {showPolygons ? "HIDE POLYGONS" : "RENDER POLYGONS"}
          </button>
          <button
            type="button"
            className={`realtime-debug-toggle${forcedUnavailable ? " realtime-debug-toggle--active" : ""}`}
            onClick={forcedUnavailable ? onClearUnavailable : onForceUnavailable}
          >
            {forcedUnavailable ? "CLEAR UNAVAILABLE" : "FORCE UNAVAILABLE"}
          </button>
          <button
            type="button"
            className="realtime-debug-toggle"
            onClick={onForcePause}
          >
            FORCE PAUSE MODAL
          </button>
          <button
            type="button"
            className={`realtime-debug-toggle${recalibrating ? " realtime-debug-toggle--active" : ""}`}
            onClick={onRecalibrate}
            disabled={recalibrating}
          >
            {recalibrating ? "CALIBRATING..." : "RECALIBRATE"}
          </button>
        </div>
      </div>
    </>
  );
}
