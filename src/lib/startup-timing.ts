/**
 * Startup timing recorder for the Roboflow GPU lifecycle.
 *
 * Each connection attempt creates one recorder. Milestones are marked as they
 * happen; `summary()` computes the derived durations the ticket cares about.
 * The summary object doubles as the future telemetry payload — a single
 * `sendBeacon` to `/api/telemetry/startup` when that route exists.
 *
 * Inject `now` for deterministic tests; defaults to `performance.now`.
 */

export type SessionType = "initial" | "retry" | "stall-reconnect" | "pause-continue";

export type MilestoneName =
  | "page_mount"
  | "attempt_start"
  | "config_loaded"
  | "video_playable"
  | "gpu_ready"
  | "first_predictions";

export type StartupSummary = {
  sessionType: SessionType;
  connectionKey: number;
  retryCount: number;
  milestones: Partial<Record<MilestoneName, number>>;
  /** Total time from attempt start to GPU session ready, in ms. */
  timeToGpuReady: number | null;
  /** Total time from attempt start to first prediction data, in ms. */
  timeToPredictions: number | null;
  /** Time between GPU ready and first predictions, in ms. */
  predictionLag: number | null;
  /** Total time from page mount to first predictions, in ms — the perceived latency. */
  perceivedLatency: number | null;
  /** Which milestone the attempt reached before it ended. */
  reachedStage: MilestoneName;
  outcome: "success" | "failed" | "in-progress";
};

export type StartupTimingRecorder = {
  mark: (name: MilestoneName) => void;
  summary: () => StartupSummary;
  fail: () => void;
};

export function createStartupTimingRecorder(opts: {
  sessionType: SessionType;
  connectionKey: number;
  retryCount: number;
  pageMountedAt?: number;
  now?: () => number;
}): StartupTimingRecorder {
  const now = opts.now ?? (() => performance.now());
  const milestones: Partial<Record<MilestoneName, number>> = {};

  if (opts.pageMountedAt != null) {
    milestones.page_mount = opts.pageMountedAt;
  }

  let outcome: StartupSummary["outcome"] = "in-progress";

  const mark = (name: MilestoneName) => {
    if (milestones[name] != null) return;
    milestones[name] = now();

    if (typeof window !== "undefined" && typeof window.performance?.mark === "function") {
      try { performance.mark(`xwalk:${name}`); } catch { /* noop */ }
    }
  };

  const reachedStage = (): MilestoneName => {
    const order: MilestoneName[] = [
      "first_predictions",
      "gpu_ready",
      "video_playable",
      "config_loaded",
      "attempt_start",
      "page_mount",
    ];
    for (const name of order) {
      if (milestones[name] != null) return name;
    }
    return "page_mount";
  };

  const duration = (from: MilestoneName, to: MilestoneName): number | null => {
    const a = milestones[from];
    const b = milestones[to];
    if (a == null || b == null) return null;
    return Math.round(b - a);
  };

  const summary = (): StartupSummary => ({
    sessionType: opts.sessionType,
    connectionKey: opts.connectionKey,
    retryCount: opts.retryCount,
    milestones: { ...milestones },
    timeToGpuReady: duration("attempt_start", "gpu_ready"),
    timeToPredictions: duration("attempt_start", "first_predictions"),
    predictionLag: duration("gpu_ready", "first_predictions"),
    perceivedLatency: duration("page_mount", "first_predictions"),
    reachedStage: reachedStage(),
    outcome,
  });

  const fail = () => { outcome = "failed"; };

  return { mark, summary, fail };
}

/**
 * Emit a performance.measure for each consecutive milestone pair, plus the
 * three derived durations. DevTools shows these as colored bars in the
 * Performance panel timeline.
 */
export function emitPerformanceMeasures(s: StartupSummary): void {
  if (typeof window === "undefined" || !window.performance?.measure) return;

  const order: MilestoneName[] = [
    "page_mount",
    "attempt_start",
    "config_loaded",
    "video_playable",
    "gpu_ready",
    "first_predictions",
  ];

  for (let i = 0; i < order.length - 1; i++) {
    const from = order[i];
    const to = order[i + 1];
    const a = s.milestones[from];
    const b = s.milestones[to];
    if (a != null && b != null) {
      try { performance.measure(`xwalk:${from}→${to}`, `xwalk:${from}`, `xwalk:${to}`); } catch { /* noop */ }
    }
  }
}

/**
 * One structured console.info line. Called once per attempt — either on
 * success (first predictions) or terminal failure.
 */
export function logStartupSummary(s: StartupSummary): void {
  const parts: string[] = [
    `outcome=${s.outcome}`,
    `type=${s.sessionType}`,
    `key=${s.connectionKey}`,
    `retry=${s.retryCount}`,
    `reached=${s.reachedStage}`,
  ];

  if (s.timeToGpuReady != null) parts.push(`gpu=${s.timeToGpuReady}ms`);
  if (s.timeToPredictions != null) parts.push(`predictions=${s.timeToPredictions}ms`);
  if (s.predictionLag != null) parts.push(`lag=${s.predictionLag}ms`);
  if (s.perceivedLatency != null) parts.push(`perceived=${s.perceivedLatency}ms`);

  console.info(`[xwalk] startup: ${parts.join(" ")}`, s);
}
