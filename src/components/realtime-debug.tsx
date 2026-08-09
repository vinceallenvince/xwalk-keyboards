"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveCalibration } from "@/lib/use-calibration";
import type { FrameSize, Stripe } from "@/lib/realtime-calibration";
import { scalePolygon } from "@/lib/realtime-calibration";

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
 * the feed so calibration accuracy can be confirmed visually.
 */
export function RealtimeDebug({ calibration, detectionPoints, frame, onForceUnavailable, onClearUnavailable, forcedUnavailable, viewportRef }: RealtimeDebugProps) {
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
    for (const boundary of [calibration.leftCrosswalk, calibration.rightCrosswalk]) {
      if (!boundary || boundary.length < 3) continue;
      const scaled = scalePolygon(boundary, frame);
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

    const colors: Record<string, string> = {
      left: "rgba(148, 215, 181, 0.7)",
      right: "rgba(181, 148, 215, 0.7)",
    };

    for (const stripe of calibration.stripes) {
      const polygon = scalePolygon(stripe.polygon, frame);
      const [first, ...rest] = polygon;
      if (!first) continue;

      ctx.beginPath();
      ctx.moveTo(offsetX + first[0] * scaleX, offsetY + first[1] * scaleY);
      for (const pt of rest) ctx.lineTo(offsetX + pt[0] * scaleX, offsetY + pt[1] * scaleY);
      ctx.closePath();
      ctx.strokeStyle = colors[stripe.segment] ?? "rgba(255,255,255,0.5)";
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
  }, [calibration.leftCrosswalk, calibration.rightCrosswalk, calibration.stripes, detectionPoints, frame, showPolygons, viewportRef]);

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
          <dt>left boundary</dt>
          <dd>{calibration.leftCrosswalk ? `${calibration.leftCrosswalk.length} pts` : "reference"}</dd>
          <dt>right boundary</dt>
          <dd>{calibration.rightCrosswalk ? `${calibration.rightCrosswalk.length} pts` : "reference"}</dd>
          <dt>frame</dt>
          <dd>{frame ? `${frame.width}×${frame.height}` : "—"}</dd>
        </dl>
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
        </div>
      </div>
    </>
  );
}
