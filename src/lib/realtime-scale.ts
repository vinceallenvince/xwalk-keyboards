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
 * Every function here is camera-agnostic: the anchor list comes in as an
 * argument, and each live camera carries its own in the registry
 * (src/data/cameras.ts). A camera's anchor list is also its registry of
 * renderable segments — a stripe whose segment has no anchor is dropped
 * rather than guessed at.
 */

const SEMITONES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** MIDI note numbers, used only to keep generated pitches inside hearing range. */
const MIDI_FLOOR = 12; // C0
const MIDI_CEILING = 108; // C8

export type SegmentAnchor = { segment: string; anchor: string };

/** The anchor note for a segment, or null when the segment is not renderable. */
export function anchorForSegment(anchors: readonly SegmentAnchor[], segment: string): string | null {
  return anchors.find((entry) => entry.segment === segment)?.anchor ?? null;
}

/** Whether this camera knows how to voice stripes from this segment. */
export function isRenderableSegment(anchors: readonly SegmentAnchor[], segment: string): boolean {
  return anchorForSegment(anchors, segment) !== null;
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
export function noteForSlot(anchors: readonly SegmentAnchor[], segment: string, index: number): string {
  const anchor = anchorForSegment(anchors, segment) ?? anchors[0]?.anchor ?? "C4";
  const anchorMidi = midiForNote(anchor) ?? midiForNote("C4")!;
  return noteForMidi(anchorMidi + Math.max(0, Math.trunc(index)));
}

/** Stable identity for one stripe, independent of what it sounds like. */
export function stripeKey(segment: string, stripeIndex: number): string {
  return `${segment}:${stripeIndex}`;
}
