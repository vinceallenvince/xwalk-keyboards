import { StudyShell } from "@/components/site-chrome";
import { RealtimeCamera } from "@/components/realtime-camera";

export default function RealtimePage() {
  return (
    <StudyShell className="realtime-shell" section="REALTIME">
      <section className="realtime-page">
        <RealtimeCamera />
      </section>
    </StudyShell>
  );
}
