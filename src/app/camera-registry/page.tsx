import { CameraRegistry } from "@/components/camera-registry";
import { FALLBACK_CAMERAS, PRIORITY_CAMERAS } from "@/data/cameras";
import { StudyShell } from "@/components/site-chrome";

export const dynamic = "force-dynamic";

export default function CameraRegistryPage() {
  return (
    <StudyShell section="CAMERA REGISTRY">
      <section className="registry-page">
        <CameraRegistry priorityCameras={PRIORITY_CAMERAS} fallbackCameras={FALLBACK_CAMERAS} />
      </section>
    </StudyShell>
  );
}
