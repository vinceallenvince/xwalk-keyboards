import { StudyShell } from "@/components/site-chrome";
import { OrchestrationGrid } from "@/components/orchestration-grid";

export default function OrchestrationPage() {
  return (
    <StudyShell section="ORCHESTRATION" className="orchestration-shell">
      <section className="orchestration-page">
        <h1 className="visually-hidden">Orchestration</h1>
        <OrchestrationGrid />
      </section>
    </StudyShell>
  );
}
