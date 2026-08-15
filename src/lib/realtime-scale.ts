/**
 * The Realtime keyboard's note range, generated rather than tabulated.
 *
 * The calibration agent is camera-agnostic: it reports however many stripes it
 * can see on a crosswalk and leaves the music to us. That count moves — paint
 * gets repainted, cameras drift, a new camera has a different crosswalk
 * entirely — so the scale cannot be a fixed list. Treat each crosswalk like a
 * keyboard that can grow keys off its right edge: slot N plays the Nth
 * semitone above that crosswalk's anchor, for any N.
 *
 * The anchors reproduce the original hand-authored 25 notes exactly — left
 * slots 0-17 give C4 through F5, right slots 0-6 give F#5 through C6 — so
 * everything that sounded a certain way still does. The generator only decides
 * what the stripes past the end of that list play.
 */

const SEMITONES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** MIDI note numbers, used only to keep generated pitches inside hearing range. */
const MIDI_FLOOR = 12; // C0
const MIDI_CEILING = 108; // C8

export type SegmentAnchor = { segment: string; anchor: string };

/**
 * Where each crosswalk's keyboard starts — one entry per renderable segment.
 * The right crosswalk begins a semitone above the left's original top note, so
 * a pedestrian crossing both in sequence walks up one continuous chromatic run.
 *
 * Anchors are fixed rather than derived from a crosswalk's detected length on
 * purpose: if the right anchor followed the left's stripe count, a van parked
 * over the left crosswalk would transpose the right one between frames.
 *
 * This list is also the registry of segments the app can render — a stripe
 * whose segment has no anchor here is dropped rather than guessed at. A camera
 * with a different crosswalk layout gets its own entries.
 */
export const SEGMENT_ANCHORS: readonly SegmentAnchor[] = [
  { segment: "left", anchor: "C4" },
  { segment: "right", anchor: "F#5" },
];

/** The anchor note for a segment, or null when the segment is not renderable. */
export function anchorForSegment(segment: string): string | null {
  return SEGMENT_ANCHORS.find((entry) => entry.segment === segment)?.anchor ?? null;
}

/** Whether the app knows how to voice stripes from this segment. */
export function isRenderableSegment(segment: string): boolean {
  return anchorForSegment(segment) !== null;
}

/** Parse a note name to its MIDI number. Returns null if it is not a note. */
export function midiForNote(note: string): number | null {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!match) return null;

  const [, letter, accidental, octave] = match;
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;

  return (Number(octave) + 1) * 12 + natural[letter] + offset;
}

function noteForMidi(midi: number): string {
  const clamped = Math.min(Math.max(Math.round(midi), MIDI_FLOOR), MIDI_CEILING);
  return `${SEMITONES[clamped % 12]}${Math.floor(clamped / 12) - 1}`;
}

/**
 * The note a slot plays: `index` semitones above the segment's anchor.
 *
 * Unbounded upward until the ceiling, so a crosswalk that reads longer than it
 * used to keeps climbing instead of piling every extra stripe onto one pitch —
 * which is what made a whole block of the right crosswalk light up at once.
 */
export function noteForSlot(segment: string, index: number): string {
  const anchor = anchorForSegment(segment) ?? SEGMENT_ANCHORS[0].anchor;
  const anchorMidi = midiForNote(anchor) ?? midiForNote(SEGMENT_ANCHORS[0].anchor)!;
  return noteForMidi(anchorMidi + Math.max(0, Math.trunc(index)));
}

/** Stable identity for one stripe, independent of what it sounds like. */
export function stripeKey(segment: string, stripeIndex: number): string {
  return `${segment}:${stripeIndex}`;
}
