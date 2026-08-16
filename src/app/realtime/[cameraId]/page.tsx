import { notFound } from "next/navigation";

import { StudyShell } from "@/components/site-chrome";
import { RealtimeCamera } from "@/components/realtime-camera";
import { RealtimeOnboardingInfoButton, RealtimeOnboardingProvider } from "@/components/realtime-onboarding";
import { LIVE_CAMERAS, liveCameraById } from "@/data/cameras";

type PageProps = { params: Promise<{ cameraId: string }> };

export function generateStaticParams() {
  return LIVE_CAMERAS.map((camera) => ({ cameraId: String(camera.cameraId) }));
}

// Only registered live cameras render; anything else is a 404, not a blank
// player pointed at a stream that does not exist.
export const dynamicParams = false;

export default async function RealtimeCameraPage({ params }: PageProps) {
  const { cameraId } = await params;
  const camera = liveCameraById(Number(cameraId));
  if (!camera) notFound();

  // The provider wraps the shell, not just the page body: the onboarding is
  // replayed from an icon in the header and rendered inside the camera
  // viewport, so both ends of that pair have to sit under the same state.
  return (
    <RealtimeOnboardingProvider>
      <StudyShell accessory={<RealtimeOnboardingInfoButton />} className="realtime-shell" section="REALTIME">
        <section className="realtime-page">
          <RealtimeCamera camera={camera} />
        </section>
      </StudyShell>
    </RealtimeOnboardingProvider>
  );
}
