import { arrayIndex as RandomArrayIndex } from 'ixfx/random.js';
import { jitterAbsolute } from 'ixfx/modulation.js';
import { Bipolar } from 'ixfx/numbers.js';

// Settings for the audio things
const settings = Object.freeze({
  // Default oscillator settings
  oscillator: {
    /** @type OscillatorType */
    type: `sawtooth`,
    frequency: 440
  },
  // If you have more voices, gain needs to be dropped
  // so there's enough head-room
  gain: 0.4,
  // Tones via https://ragajunglism.org/ragas/tanpuras/
  tones: [130.8, 138.6, 146.8, 155.6, 164.8, 174.6, 92.5, 98, 103.8, 110, 116.5, 123.5, 55],
  // Drift each voice's frequency a little
  frequencyJitter: jitterAbsolute({ relative: 0.001 }),
  // Drift each voice's panning a little
  panJitter: jitterAbsolute({ relative: 0.1 })
});

/**
 * Use the Thing.
 * Applies current pan, frequency and gain settings to the
 * audio graph
 * @param {Thing} thing 
 */
export const use = (thing) => {
  const { frequency, gain, node } = thing;
  const { ctx, pan } = node;
  pan.pan.setValueAtTime(thing.pan, ctx.currentTime);
  node.osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  node.gain.gain.setValueAtTime(gain, ctx.currentTime);
};

/**
 * Update.
 * Computes new pan & frequency values for the thing
 * @param {Thing} thing 
 * @returns 
 */
export const update = (thing) => {
  const { frequencyJitter, panJitter, gain } = settings;

  thing = {
    ...thing,
    gain,
    pan: Bipolar.clamp(panJitter(thing.pan)),
    frequency: frequencyJitter(thing.frequency)
  };
  return thing;
};

/**
 * Removes the Thing
 * @param {Thing} thing 
 */
export const remove = (thing) => {
  const { node } = thing;
  const { ctx } = node;

  // Fade out
  node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.9);

  // Stop after 10s
  node.osc.stop(ctx.currentTime + 10_000);

  setTimeout(() => {
    node.osc.disconnect();
  }, 10_000);
};

/**
 * Create 'thing' and accompanying oscillator
 * @param {AudioContext} context
 * @returns {Thing} 
 */
export const create = (context) => {
  const { oscillator, tones, frequencyJitter: driftJitter } = settings;

  // Pick a random base frequency
  let frequency = tones[RandomArrayIndex(tones)];

  // Add drift
  frequency = frequency + driftJitter(frequency);

  // Source oscillator
  const osc = context.createOscillator();
  osc.type = oscillator.type;
  osc.frequency.setValueAtTime(frequency, context.currentTime);

  // Create stereo panner
  const pan = context.createStereoPanner();

  // Create gain node
  const gain = context.createGain();

  // Create filter
  const filter = context.createBiquadFilter();

  // Patch in
  // Oscillator -> gain -> panner -> filter -> speakers
  osc.connect(gain);
  gain.connect(pan);
  pan.connect(filter);
  filter.connect(context.destination);

  // Mute oscillator when first created
  gain.gain.setValueAtTime(0, context.currentTime);

  // Start oscillator (but it's muted)
  osc.start();
  return {
    node: {
      ctx: context,
      filter, gain,
      osc: osc, pan
    },
    frequency,
    gain: 0,
    // Start with random pan value
    pan: Bipolar.random()
  };
};

/**
 * @typedef {{
 * type: OscillatorType
 * frequency: number
 * }} OscillatorOpts
 */

/**
 * @typedef {Readonly<{ 
 * ctx: AudioContext
 * pan: StereoPannerNode
 * gain: GainNode
 * filter: BiquadFilterNode
 * osc: OscillatorNode
 * }>} AudioNode
 */

/**
 * @typedef {Readonly<{
 * frequency: number
 * gain: number
 * node: AudioNode
 * pan: number
 * }>} Thing
 */