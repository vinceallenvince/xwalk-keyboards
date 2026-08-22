/**
 * The Realtime keyboard's note range, generated rather than tabulated.
 *
 * The calibration agent is camera-agnostic: it reports however many stripes it
 * can see, grouped into gap-separated clusters, and leaves the music to us.
 * Both numbers move — paint gets repainted, a truck splits one run into two,
 * dusk hides half the bars — so the scale cannot be a fixed list, and it cannot
 * be pinned per cluster either.
 *
 * So the keyboard is one continuous run: order the clusters along the crossing,
 * number every stripe globally, and play `baseAnchor + ordinal`. A cluster that
 * splits in two changes nothing, because the global sequence is unchanged. A
 * stripe that goes missing shifts everything after it — the trade VIN-44 signed.
 * The instrument may be transposed from yesterday, but it is always in tune with
 * itself and its keys are always on the paint.
 */

const SEMITONES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

/** MIDI note numbers, used only to keep generated pitches inside hearing range. */
const MIDI_FLOOR = 12; // C0
const MIDI_CEILING = 108; // C8

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

/** The trailing integer in a cluster name, or null when it has none. */
function segmentOrdinal(segment: string): number | null {
  const match = /(\d+)$/.exec(segment);
  return match ? Number(match[1]) : null;
}

/** Sorts after every numbered cluster, without special-casing in the compare. */
const UNNUMBERED = Number.MAX_SAFE_INTEGER;

/**
 * Order clusters along the crossing.
 *
 * The agent names them positionally (`segment0`, `segment1`, ...), so the
 * trailing number is the order — and comparing it numerically is what keeps
 * `segment10` after `segment9` instead of after `segment1`. A name carrying no
 * number is not something the pipeline produces; it sorts last, by name, purely
 * so the ordering stays total rather than leaving the keyboard's order to
 * whatever order the payload happened to arrive in.
 */
export function compareSegments(a: string, b: string): number {
  return (segmentOrdinal(a) ?? UNNUMBERED) - (segmentOrdinal(b) ?? UNNUMBERED)
    || a.localeCompare(b);
}

/**
 * The note a stripe plays: `ordinal` semitones above the camera's base anchor,
 * counted across every cluster from the start of the crossing.
 *
 * Unbounded upward until the ceiling, so a crossing that reads longer than it
 * used to keeps climbing instead of piling every extra stripe onto one pitch —
 * which is what made a whole block of the right crosswalk light up at once.
 */
export function noteForOrdinal(baseAnchor: string, ordinal: number): string {
  const anchorMidi = midiForNote(baseAnchor) ?? midiForNote("C4")!;
  return noteForMidi(anchorMidi + Math.max(0, Math.trunc(ordinal)));
}

/** Stable identity for one stripe, independent of what it sounds like. */
export function stripeKey(segment: string, stripeIndex: number): string {
  return `${segment}:${stripeIndex}`;
}

/**
 * Identity of a whole keyboard, for spotting when the agent has re-cut it.
 *
 * Two calibrations share a signature only if they name the same stripes. Since
 * a key is `cluster:ordinal` and ordinals are contiguous within a cluster, this
 * changes whenever a cluster splits, merges, is renamed, or gains or loses a
 * stripe — every case where a pedestrian standing still would otherwise look
 * newly arrived to the note trigger.
 */
export function keyboardSignature(stripes: readonly { segment: string; stripeIndex: number }[]): string {
  return stripes.map((stripe) => stripeKey(stripe.segment, stripe.stripeIndex)).join();
}
