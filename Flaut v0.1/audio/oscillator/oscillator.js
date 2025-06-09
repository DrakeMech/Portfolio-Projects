/**
 * Initialise audio with an oscillator source
 * @param {Options} [oscillatorOptions] 
 * @returns {BasicAudio}
 */
export function create(oscillatorOptions = {}) {
  const context = new AudioContext();
  const oscType = oscillatorOptions.type ?? `sawtooth`;
  const oscFreq = oscillatorOptions.frequency ?? 440;

  // Source oscillator
  const source = context.createOscillator();
  source.type = oscType;
  source.frequency.setValueAtTime(oscFreq, context.currentTime);

  // Create stereo panner
  const pan = context.createStereoPanner();

  // Create gain node
  const gain = context.createGain();

  // Create filter
  const filter = context.createBiquadFilter();

  // Patch in
  // Oscillator -> gain -> panner -> speakers
  source.connect(gain);
  gain.connect(pan);
  pan.connect(filter);
  filter.connect(context.destination);

  return {
    pan, gain, filter,
    ctx: context,
    osc: source
  };
}

/**
 * @typedef Options
 * @property {OscillatorType} [type]
 * @property {number} [frequency]
 */

/**
 * @typedef BasicAudio
 * @property {AudioContext} ctx
 * @property {StereoPannerNode} pan
 * @property {GainNode} gain
 * @property {BiquadFilterNode} filter
 * @property {OscillatorNode} osc
 */