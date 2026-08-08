export const CROSSWALK_INTERVAL_SECONDS = 5;
export const CROSSWALK_DURATION_SECONDS = 60;

export const GRID_POSITIONS = [
  "top-left", "top-middle-left", "top-middle-right", "top-right",
  "middle-left", "middle-middle-left", "middle-middle-right", "middle-right",
  "bottom-left", "bottom-middle-left", "bottom-middle-right", "bottom-right",
] as const;

export type GridPosition = (typeof GRID_POSITIONS)[number];

export type CrosswalkBatchManifest = {
  batchId: string;
  cameras: Array<{
    cameraId: number;
    gridPosition: GridPosition;
    index: number;
    intervalStartSeconds: number;
    predictionCount: number | null;
    sourceCameraId: number;
    sourceTimestamp: string | null;
  }>;
  createdAt: string;
  durationSeconds: 60;
  intervalSeconds: 5;
  schemaVersion: "1";
};

export type CrosswalkScore = {
  batchId: string;
  durationSeconds: 60;
  events: Array<{
    arpeggioSpacingSeconds: number;
    audioDescription: string;
    cameraId: number;
    confidence: number;
    durationSeconds: number;
    gesture: "chord" | "ascending" | "descending" | "pulse" | "swell" | "scatter" | "rest";
    gridPosition: GridPosition;
    index: number;
    intervalStartSeconds: number;
    notes: string[];
    occupancy: "none" | "occupied" | "uncertain";
    occupiedStripeIndexes: number[];
    octaveShift: -1 | 0 | 1;
    pan: number;
    velocity: number;
    visual: { presentation: "grid" | "hero"; rationale: string };
    voiceId: string;
  }>;
  fallbackReason?: string;
  intervalSeconds: 5;
  model: string;
  musicDirection: { description: string; masterReverb: number; title: string };
  schemaVersion: "3";
  source: "agent" | "fallback" | "mock";
  voices: CrosswalkVoice[];
};

export type CrosswalkEffect = {
  preset: "bright" | "dark" | "dotted" | "grit" | "longHall" | "pulse" | "resonant" | "room" | "shimmer" | "slow" | "smallHall" | "soft" | "subtle" | "warm" | "wide";
  type: "chorus" | "distortion" | "filter" | "pingPongDelay" | "reverb" | "tremolo";
  wet: number;
};

export type CrosswalkVoice = {
  effects: CrosswalkEffect[];
  id: string;
  instrument: "amPoly" | "fmPoly" | "pluck" | "synthPoly";
  preset: "bell" | "bright" | "dark" | "distant" | "dry" | "electric" | "glass" | "hollow" | "nasal" | "pad" | "resonant" | "round" | "soft" | "warm" | "wood";
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asInteger(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

function asNumber(value: unknown, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

export function stripeIndexToNote(stripeIndex: number, octaveShift = 0) {
  const pitchClasses = ["C", "D", "Eb", "F", "G", "Ab", "B"];
  if (!Number.isInteger(stripeIndex) || stripeIndex < 0 || stripeIndex > 20 || ![-1, 0, 1].includes(octaveShift)) {
    throw new Error("Invalid score stripe index or octave shift");
  }
  return `${pitchClasses[stripeIndex % pitchClasses.length]}${4 + Math.floor(stripeIndex / pitchClasses.length) + octaveShift}`;
}

export function createCrosswalkBatchManifest(
  batchId: string,
  createdAt: string,
  frames: readonly { cameraId: number; predictionCount: number | null; sourceCameraId: number; sourceTimestamp: string | null }[]
): CrosswalkBatchManifest {
  if (!batchId || frames.length !== GRID_POSITIONS.length) throw new Error("A batch requires exactly twelve ordered frames");
  return {
    batchId,
    createdAt,
    durationSeconds: CROSSWALK_DURATION_SECONDS,
    intervalSeconds: CROSSWALK_INTERVAL_SECONDS,
    schemaVersion: "1",
    cameras: frames.map((frame, index) => ({
      ...frame,
      gridPosition: GRID_POSITIONS[index],
      index,
      intervalStartSeconds: index * CROSSWALK_INTERVAL_SECONDS,
    })),
  };
}

export function parseCrosswalkBatchManifest(value: unknown): CrosswalkBatchManifest | null {
  if (!isRecord(value) || value.schemaVersion !== "1" || typeof value.batchId !== "string" || !value.batchId || typeof value.createdAt !== "string" || value.intervalSeconds !== 5 || value.durationSeconds !== 60 || !Array.isArray(value.cameras) || value.cameras.length !== 12) return null;
  const cameras = value.cameras.map((camera, index) => {
    if (!isRecord(camera) || camera.index !== index || camera.gridPosition !== GRID_POSITIONS[index] || camera.intervalStartSeconds !== index * 5 || asInteger(camera.cameraId, 1, Number.MAX_SAFE_INTEGER) === null || asInteger(camera.sourceCameraId, 1, Number.MAX_SAFE_INTEGER) === null || (camera.predictionCount !== null && asInteger(camera.predictionCount, 0, Number.MAX_SAFE_INTEGER) === null) || (camera.sourceTimestamp !== null && typeof camera.sourceTimestamp !== "string")) return null;
    return camera as CrosswalkBatchManifest["cameras"][number];
  });
  if (cameras.some((camera) => camera === null)) return null;
  return { ...value, cameras } as CrosswalkBatchManifest;
}

const gestures = new Set<CrosswalkScore["events"][number]["gesture"]>(["chord", "ascending", "descending", "pulse", "swell", "scatter", "rest"]);
const occupancies = new Set<CrosswalkScore["events"][number]["occupancy"]>(["none", "occupied", "uncertain"]);
const instrumentPresets = {
  amPoly: new Set(["distant", "nasal", "soft", "warm"]),
  fmPoly: new Set(["bell", "electric", "glass", "hollow"]),
  pluck: new Set(["dry", "resonant", "soft", "wood"]),
  synthPoly: new Set(["bright", "dark", "pad", "round"]),
} as const;
const effectPresets = {
  chorus: new Set(["slow", "shimmer"]),
  distortion: new Set(["soft", "grit"]),
  filter: new Set(["bright", "dark", "warm"]),
  pingPongDelay: new Set(["dotted", "subtle", "wide"]),
  reverb: new Set(["longHall", "room", "smallHall"]),
  tremolo: new Set(["pulse", "slow"]),
} as const;

function parseVoices(value: unknown): CrosswalkVoice[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return null;
  const voiceIds = new Set<string>();
  const voices: CrosswalkVoice[] = [];
  for (const voice of value) {
    if (!isRecord(voice) || typeof voice.id !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(voice.id) || voiceIds.has(voice.id) || typeof voice.instrument !== "string" || !(voice.instrument in instrumentPresets) || typeof voice.preset !== "string" || !instrumentPresets[voice.instrument as keyof typeof instrumentPresets].has(voice.preset)) return null;
    if (!Array.isArray(voice.effects) || voice.effects.length > 3) return null;
    const effects: CrosswalkEffect[] = [];
    for (const effect of voice.effects) {
      if (!isRecord(effect) || typeof effect.type !== "string" || !(effect.type in effectPresets) || typeof effect.preset !== "string" || !effectPresets[effect.type as keyof typeof effectPresets].has(effect.preset) || asNumber(effect.wet, 0, 0.4) === null) return null;
      effects.push({
        preset: effect.preset as CrosswalkEffect["preset"],
        type: effect.type as CrosswalkEffect["type"],
        wet: effect.wet as number,
      });
    }
    voiceIds.add(voice.id);
    voices.push({
      effects,
      id: voice.id,
      instrument: voice.instrument as CrosswalkVoice["instrument"],
      preset: voice.preset as CrosswalkVoice["preset"],
    });
  }
  return voices;
}

export function adaptAndValidateCrosswalkScore(value: unknown, manifest: CrosswalkBatchManifest): CrosswalkScore | null {
  if (!isRecord(value) || value.schemaVersion !== "3" || value.batchId !== manifest.batchId || value.intervalSeconds !== 5 || value.durationSeconds !== 60 || !Array.isArray(value.events) || value.events.length !== 12 || !isRecord(value.musicDirection)) return null;
  const direction = value.musicDirection;
  if (typeof direction.title !== "string" || typeof direction.description !== "string" || asNumber(direction.masterReverb, 0, 0.4) === null) return null;
  const voices = parseVoices(value.voices);
  if (!voices) return null;

  const events = value.events.map((event, index) => {
    const camera = manifest.cameras[index];
    if (!isRecord(event) || event.index !== index || event.cameraId !== camera.cameraId || event.gridPosition !== camera.gridPosition || event.intervalStartSeconds !== camera.intervalStartSeconds || !occupancies.has(event.occupancy as CrosswalkScore["events"][number]["occupancy"]) || !gestures.has(event.gesture as CrosswalkScore["events"][number]["gesture"]) || !Array.isArray(event.occupiedStripeIndexes) || !event.occupiedStripeIndexes.every((stripe) => asInteger(stripe, 0, 20) !== null) || new Set(event.occupiedStripeIndexes).size !== event.occupiedStripeIndexes.length || typeof event.voiceId !== "string" || typeof event.audioDescription !== "string" || asNumber(event.confidence, 0, 1) === null || asNumber(event.durationSeconds, 0.1, 4.5) === null || asNumber(event.velocity, 0.1, 0.85) === null || asNumber(event.pan, -0.85, 0.85) === null || ![-1, 0, 1].includes(event.octaveShift as number) || asNumber(event.arpeggioSpacingSeconds, 0.05, 0.5) === null) return null;
    const occupancy = event.occupancy as CrosswalkScore["events"][number]["occupancy"];
    const indexes = event.occupiedStripeIndexes as number[];
    if ((occupancy !== "occupied" && (indexes.length > 0 || event.gesture !== "rest")) || (occupancy === "occupied" && indexes.length === 0)) return null;
    const octaveShift = event.octaveShift as -1 | 0 | 1;
    const expectedNotes = indexes.map((stripe) => stripeIndexToNote(stripe, octaveShift));
    if (!isRecord(event.visual) || (event.visual.presentation !== "grid" && event.visual.presentation !== "hero") || typeof event.visual.rationale !== "string" || !event.visual.rationale.trim()) return null;
    const visual = { presentation: event.visual.presentation, rationale: event.visual.rationale.trim().slice(0, 240) };
    return {
      arpeggioSpacingSeconds: event.arpeggioSpacingSeconds as number,
      audioDescription: event.audioDescription,
      cameraId: event.cameraId as number,
      confidence: event.confidence as number,
      durationSeconds: event.durationSeconds as number,
      gesture: event.gesture as CrosswalkScore["events"][number]["gesture"],
      gridPosition: event.gridPosition as GridPosition,
      index,
      intervalStartSeconds: event.intervalStartSeconds as number,
      notes: expectedNotes,
      occupancy,
      occupiedStripeIndexes: indexes,
      octaveShift,
      pan: event.pan as number,
      velocity: event.velocity as number,
      visual,
      voiceId: event.voiceId,
    };
  });
  if (events.some((event) => event === null)) return null;

  return {
    batchId: manifest.batchId,
    durationSeconds: CROSSWALK_DURATION_SECONDS,
    events: events as CrosswalkScore["events"],
    fallbackReason: typeof value.fallbackReason === "string" ? value.fallbackReason : undefined,
    intervalSeconds: CROSSWALK_INTERVAL_SECONDS,
    model: typeof value.model === "string" ? value.model : "crosswalk-agent",
    musicDirection: { description: direction.description, masterReverb: direction.masterReverb as number, title: direction.title },
    schemaVersion: "3",
    source: value.source === "fallback" || value.source === "mock" ? value.source : "agent",
    voices,
  };
}
