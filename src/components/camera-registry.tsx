"use client";

import { useEffect, useState } from "react";

import type { CameraRecord } from "@/data/cameras";
import { RegistryLivePreview } from "./registry-live-preview";

type SnapshotState = {
  imageSource?: string;
  status: "loading" | "active" | "unavailable" | "error";
  message?: string;
};

type RegistryCamera = Pick<CameraRecord, "cameraId" | "cameraKey" | "displayLabel" | "location" | "viewUrl">;

function CameraCard({ camera, state }: { camera: RegistryCamera; state: SnapshotState | undefined }) {
  const snapshot = state ?? { status: "loading" as const };
  const stateLabel =
    snapshot.status === "active"
      ? "Snapshot captured once"
      : snapshot.status === "unavailable"
        ? "Unavailable source"
        : snapshot.status === "error"
          ? "Snapshot unavailable"
          : "Capturing one snapshot…";

  return (
    <article className="camera-card">
      <div className="snapshot-frame">
        {snapshot.imageSource ? (
          // The registry intentionally uses the raw 511NY snapshot, never an inference result.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshot.imageSource} alt={`511NY camera view ${camera.cameraId}`} />
        ) : (
          <div className="snapshot-placeholder">{snapshot.message ?? stateLabel}</div>
        )}
        {snapshot.status !== "unavailable" && snapshot.status !== "active" && (
          <span className={`snapshot-state snapshot-state--${snapshot.status}`}>{stateLabel}</span>
        )}
      </div>
      <div className="camera-card__details">
        <div>
          <h3>{camera.displayLabel}</h3>
          <p>cam-id: {camera.cameraKey}</p>
        </div>
        <a href={camera.viewUrl} target="_blank" rel="noreferrer" aria-label={`Open View ${camera.cameraId} on 511NY`}>OPEN ↗</a>
      </div>
    </article>
  );
}

export function CameraRegistry({ fallbackCameras, priorityCameras }: {
  fallbackCameras: readonly RegistryCamera[];
  priorityCameras: readonly RegistryCamera[];
}) {
  const [snapshots, setSnapshots] = useState<Record<number, SnapshotState>>({});

  useEffect(() => {
    const controller = new AbortController();
    const objectUrls: string[] = [];
    let cancelled = false;
    const cameras = [...priorityCameras, ...fallbackCameras];

    async function loadSnapshot(camera: RegistryCamera) {
      try {
        const response = await fetch(`/api/snapshot/${camera.cameraId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
        const imageSource = URL.createObjectURL(await response.blob());
        objectUrls.push(imageSource);
        if (cancelled) return;
        setSnapshots((current) => ({
          ...current,
          [camera.cameraId]: {
            imageSource,
            status: response.headers.get("x-camera-status") === "unavailable" ? "unavailable" : "active",
          },
        }));
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        setSnapshots((current) => ({
          ...current,
          [camera.cameraId]: {
            message: error instanceof Error ? error.message : "Unable to load snapshot",
            status: "error",
          },
        }));
      }
    }

    void Promise.all(cameras.map(loadSnapshot));
    return () => {
      cancelled = true;
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [fallbackCameras, priorityCameras]);

  return (
    <div className="registry-layout">
      <div className="registry-content">
        <section aria-labelledby="priority-cameras">
          <div className="section-heading">
            <h2 id="priority-cameras">Priority cameras</h2>
            <i aria-hidden="true" />
          </div>
          <div className="camera-grid">
            {priorityCameras.map((camera) => <CameraCard key={camera.cameraId} camera={camera} state={snapshots[camera.cameraId]} />)}
          </div>
        </section>
        <section aria-labelledby="fallback-cameras">
          <div className="section-heading section-heading--spaced">
            <h2 id="fallback-cameras">Fallback cameras</h2>
            <i aria-hidden="true" />
          </div>
          <div className="camera-grid camera-grid--fallback">
            {fallbackCameras.map((camera) => <CameraCard key={camera.cameraId} camera={camera} state={snapshots[camera.cameraId]} />)}
          </div>
        </section>
      </div>
      <aside className="live-column" aria-labelledby="live-feeds">
        <h2 id="live-feeds"><span className="live-indicator" aria-hidden="true" />Live feeds</h2>
        <article className="live-feed-card">
          <RegistryLivePreview />
          <p>Feed 01 // West St @ W34</p>
          <a href="https://511ny.org/map/Cctv/5056" target="_blank" rel="noreferrer">OPEN 511NY ↗</a>
        </article>
        <p className="aside-note">One snapshot per static source. No polling or Roboflow inference occurs here.</p>
      </aside>
    </div>
  );
}
