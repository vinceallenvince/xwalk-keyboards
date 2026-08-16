import { StudyShell } from "@/components/site-chrome";
import { RealtimeCamera } from "@/components/realtime-camera";
import { RealtimeOnboardingInfoButton, RealtimeOnboardingProvider } from "@/components/realtime-onboarding";
import { DEFAULT_LIVE_CAMERA } from "@/data/cameras";

export default function RealtimePage() {
  // The provider wraps the shell, not just the page body: the onboarding is
  // replayed from an icon in the header and rendered inside the camera
  // viewport, so both ends of that pair have to sit under the same state.
  return (
    <RealtimeOnboardingProvider>
      <StudyShell accessory={<RealtimeOnboardingInfoButton />} className="realtime-shell" section="REALTIME">
        <section className="realtime-page">
          <RealtimeCamera camera={DEFAULT_LIVE_CAMERA} />
        </section>
      </StudyShell>
    </RealtimeOnboardingProvider>
  );
}
