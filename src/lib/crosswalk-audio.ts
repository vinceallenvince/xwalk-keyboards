import type { CrosswalkScore, CrosswalkVoice } from "./crosswalk-score";

type ToneModule = typeof import("tone");
type EventCallback = (event: CrosswalkScore["events"][number]) => void;

export type CrosswalkScorePlayer = {
  dispose: () => void;
  enable: () => Promise<void>;
  play: (score: CrosswalkScore, onEvent: EventCallback, onComplete: () => void) => Promise<void>;
  stop: () => void;
};

const FM_PRESETS = {
  bell: { harmonicity: 2.8, modulationIndex: 10 },
  electric: { harmonicity: 1.5, modulationIndex: 8 },
  glass: { harmonicity: 3.01, modulationIndex: 14 },
  hollow: { harmonicity: 0.75, modulationIndex: 5 },
} as const;
const AM_PRESETS = { distant: { harmonicity: .5 }, nasal: { harmonicity: 3 }, soft: { harmonicity: 1.25 }, warm: { harmonicity: 2 } } as const;
const SYNTH_PRESETS = { bright: { oscillator: { type: "square" as const } }, dark: { oscillator: { type: "sine" as const } }, pad: { oscillator: { type: "triangle" as const } }, round: { oscillator: { type: "sine" as const } } } as const;
const PLUCK_PRESETS = { dry: { envelope: { attack: .005, decay: .12, release: .1, sustain: 0 } }, resonant: { envelope: { attack: .008, decay: .45, release: .8, sustain: .02 } }, soft: { envelope: { attack: .02, decay: .28, release: .35, sustain: 0 } }, wood: { envelope: { attack: .005, decay: .2, release: .2, sustain: 0 } } } as const;

function createSynth(Tone: ToneModule, voice: CrosswalkVoice) {
  const synth = voice.instrument === "fmPoly"
    ? new Tone.PolySynth(Tone.FMSynth, FM_PRESETS[voice.preset as keyof typeof FM_PRESETS])
    : voice.instrument === "amPoly"
      ? new Tone.PolySynth(Tone.AMSynth, AM_PRESETS[voice.preset as keyof typeof AM_PRESETS])
      : voice.instrument === "pluck"
        ? new Tone.PolySynth(Tone.Synth, PLUCK_PRESETS[voice.preset as keyof typeof PLUCK_PRESETS])
        : new Tone.PolySynth(Tone.Synth, SYNTH_PRESETS[voice.preset as keyof typeof SYNTH_PRESETS]);
  synth.volume.value = voice.instrument === "pluck" ? -15 : -13;
  return synth;
}

function createEffect(Tone: ToneModule, effect: CrosswalkVoice["effects"][number]) {
  if (effect.type === "reverb") {
    const decay = { longHall: 4.2, room: 1.1, smallHall: 2.2 }[effect.preset as "longHall" | "room" | "smallHall"];
    const node = new Tone.Reverb({ decay, preDelay: .01, wet: effect.wet });
    return { node, ready: node.ready };
  }
  if (effect.type === "pingPongDelay") {
    const settings = { dotted: { delayTime: "8n." as const, feedback: .18 }, subtle: { delayTime: "8n" as const, feedback: .1 }, wide: { delayTime: "4n" as const, feedback: .24 } }[effect.preset as "dotted" | "subtle" | "wide"];
    return { node: new Tone.PingPongDelay({ ...settings, wet: effect.wet }) };
  }
  if (effect.type === "chorus") {
    const settings = effect.preset === "shimmer" ? { delayTime: 2.5, depth: .55, frequency: 1.5 } : { delayTime: 3.5, depth: .35, frequency: .4 };
    return { node: new Tone.Chorus({ ...settings, wet: effect.wet }).start() };
  }
  if (effect.type === "filter") return { node: new Tone.Filter({ frequency: { bright: 9000, dark: 1800, warm: 4200 }[effect.preset as "bright" | "dark" | "warm"], rolloff: -12, type: "lowpass" }) };
  if (effect.type === "tremolo") return { node: new Tone.Tremolo({ depth: effect.preset === "pulse" ? .65 : .3, frequency: effect.preset === "pulse" ? 3 : .8, wet: effect.wet }).start() };
  return { node: new Tone.Distortion({ distortion: effect.preset === "grit" ? .22 : .08, oversample: "2x", wet: effect.wet }) };
}

function scatter(notes: readonly string[], seed: string) {
  return [...notes].sort((left, right) => [...`${seed}:${left}`].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619), 2_166_136_261) - [...`${seed}:${right}`].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619), 2_166_136_261));
}

export async function createCrosswalkScorePlayer(): Promise<CrosswalkScorePlayer> {
  const Tone = await import("tone");
  const transport = Tone.getTransport();
  const draw = Tone.getDraw();
  const limiter = new Tone.Limiter(-6).toDestination();
  const masterReverb = new Tone.Reverb({ decay: 1.8, wet: .2 }).connect(limiter);
  const beat = new Tone.MembraneSynth({ envelope: { attack: .001, decay: .07, release: .02 }, octaves: 2, pitchDecay: .02 }).connect(limiter);
  let generation = 0;
  let disposables: Array<{ dispose: () => unknown }> = [];

  const stop = () => {
    generation += 1;
    transport.stop();
    transport.cancel(0);
    transport.seconds = 0;
    disposables.forEach((node) => node.dispose());
    disposables = [];
  };

  return {
    dispose: () => { stop(); beat.dispose(); masterReverb.dispose(); limiter.dispose(); },
    enable: async () => { await Tone.start(); await masterReverb.ready; },
    play: async (score, onEvent, onComplete) => {
      stop();
      transport.bpm.value = 96;
      masterReverb.wet.value = score.musicDirection.masterReverb;
      const voices = new Map<string, { panner: import("tone").Panner; synth: import("tone").PolySynth }>();
      const ready: Promise<unknown>[] = [];
      for (const voice of score.voices) {
        const synth = createSynth(Tone, voice);
        const effects = voice.effects.map((effect) => createEffect(Tone, effect));
        const panner = new Tone.Panner(0).connect(masterReverb);
        synth.connect(effects[0]?.node ?? panner);
        effects.forEach((effect, index) => effect.node.connect(effects[index + 1]?.node ?? panner));
        ready.push(...effects.flatMap((effect) => effect.ready ? [effect.ready] : []));
        disposables.push(synth, panner, ...effects.map((effect) => effect.node));
        voices.set(voice.id, { panner, synth });
      }
      await Promise.all(ready);
      const playbackGeneration = generation;
      transport.scheduleRepeat((time) => beat.triggerAttackRelease("C2", "32n", time, .11), "4n", 0, 60);
      score.events.forEach((event) => {
        transport.scheduleOnce((time) => {
          if (generation !== playbackGeneration) return;
          const voice = voices.get(event.voiceId);
          if (voice && event.notes.length && event.gesture !== "rest") {
            voice.panner.pan.setValueAtTime(event.pan, time);
            const notes = event.gesture === "descending" ? [...event.notes].reverse() : event.gesture === "scatter" ? scatter(event.notes, `${score.batchId}:${event.index}`) : event.notes;
            if (["ascending", "descending", "scatter"].includes(event.gesture)) notes.forEach((note, index) => voice.synth.triggerAttackRelease(note, event.durationSeconds, time + index * event.arpeggioSpacingSeconds, event.velocity));
            else if (event.gesture === "pulse") [0, Math.max(.45, event.arpeggioSpacingSeconds * 3), Math.max(.9, event.arpeggioSpacingSeconds * 6)].forEach((offset) => voice.synth.triggerAttackRelease(notes, Math.min(event.durationSeconds, .35), time + offset, event.velocity));
            else voice.synth.triggerAttackRelease(notes, event.durationSeconds, time, event.velocity);
          }
          draw.schedule(() => { if (generation === playbackGeneration) onEvent(event); }, time);
        }, event.intervalStartSeconds);
      });
      transport.scheduleOnce((time) => draw.schedule(() => { if (generation === playbackGeneration) { stop(); onComplete(); } }, time), 60);
      transport.start("+0.08");
    },
    stop,
  };
}
