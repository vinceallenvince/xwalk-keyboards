import { CameraRegistry } from "@/components/camera-registry";
import { LIVE_CAMERAS } from "@/data/cameras";
import { StudyShell } from "@/components/site-chrome";

export const dynamic = "force-dynamic";

export default function CameraRegistryPage() {
  return (
    <StudyShell section="CAMERA REGISTRY">
      <section className="registry-page">
        <CameraRegistry cameras={LIVE_CAMERAS} />
      </section>
    </StudyShell>
  );
}
