import { StudyShell } from "@/components/site-chrome";
import { RealtimeCamera } from "@/components/realtime-camera";
import { RealtimeIntroButton, RealtimeIntroProvider } from "@/components/realtime-intro";

export default function RealtimePage() {
  // The provider wraps the shell, not just the page body: the instructions are
  // opened from an icon in the header and rendered inside the camera viewport,
  // so both ends of that pair have to sit under the same state.
  return (
    <RealtimeIntroProvider>
      <StudyShell accessory={<RealtimeIntroButton />} className="realtime-shell" section="REALTIME">
        <section className="realtime-page">
          <RealtimeCamera />
        </section>
      </StudyShell>
    </RealtimeIntroProvider>
  );
}
