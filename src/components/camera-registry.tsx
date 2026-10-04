import type { LiveCameraRecord } from "@/data/cameras";
import { RegistryLivePreview } from "./registry-live-preview";

type RegistryCamera = Pick<LiveCameraRecord, "cameraId" | "externalUrl" | "location" | "sourceKind">;

const PROVIDER_NAMES: Record<LiveCameraRecord["sourceKind"], string> = {
  "511ny": "511NY",
  bellevue: "the City of Bellevue traffic map",
  carla: "CARLA",
};

function CameraCard({ camera, index }: { camera: RegistryCamera; index: number }) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article className="registry-card">
      <RegistryLivePreview cameraId={camera.cameraId} />
      <div className="registry-card__meta">
        <div className="registry-card__title">
          <h2>
            <span className="registry-card__label--wide">{`CAMERA_${number} // VIEW_${camera.cameraId}`}</span>
            <span className="registry-card__label--compact">{`CAM ${number} // ${camera.cameraId}`}</span>
          </h2>
          {camera.externalUrl && (
            <a
              className="registry-card__link"
              href={camera.externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open camera ${camera.cameraId} on ${PROVIDER_NAMES[camera.sourceKind]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative icon from the Figma frame */}
              <img src="/icons/external-link.svg" width={17.75} height={17.75} alt="" />
            </a>
          )}
        </div>
        <p>
          <span className="registry-card__label--wide">STREET LOCATION: </span>
          {camera.location}
        </p>
      </div>
    </article>
  );
}

/**
 * Every registered live camera, in registry order, each playing its own feed.
 * A camera whose feed is down keeps its place and reads as unavailable; that
 * is what makes the page useful to developers.
 */
export function CameraRegistry({ cameras }: { cameras: readonly RegistryCamera[] }) {
  return (
    <div className="registry-grid">
      {cameras.map((camera, index) => <CameraCard key={camera.cameraId} camera={camera} index={index} />)}
    </div>
  );
}
