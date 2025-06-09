/** @typedef {"allpass" | "bandpass" | "highpass" | "highshelf" | "lowpass" | "lowshelf" | "notch" | "peaking"} 
 * FilterType 
 * */

export class Audio {
  #initialised;
  /** @type Map<string,BasicAudio> */
  #sources = new Map();

  /** @type FilterType */
  filterType = `lowpass`;
  constructor() {}

  init() {
    if (this.#initialised) return;
    this.#initialised = true;

    for (const element of document.querySelectorAll(`audio`)) {
      this.#sources.set(element.id, this.#initElement(element));
    }
  }

  /**
   * Gets a BasicAudio instance by ke
   * @param {string} key 
   * @returns 
   */
  get(key) {
    this.init();
    return this.#sources.get(key);
  }

  /**
 * Initialise audio
 * @param {HTMLMediaElement} audioElement
 * @returns {BasicAudio}
 */
  #initElement(audioElement) {
    const context = new AudioContext();

    // Source from AUDIO element
    const source = context.createMediaElementSource(audioElement);

    // Create stereo panner
    const pan = context.createStereoPanner();

    // Create gain node
    const gain = context.createGain();

    // Create filter
    const filter = context.createBiquadFilter();
    filter.type = this.filterType;

    // Patch in
    // AUDIO elem -> gain -> panner -> speakers
    source.connect(gain);
    gain.connect(pan);
    pan.connect(filter);
    filter.connect(context.destination);

    return {
      pan, gain, filter,
      id: audioElement.id,
      ctx: context,
      el: audioElement
    };
  }
}


/**
 * @typedef BasicAudio
 * @property {AudioContext} ctx
 * @property {StereoPannerNode} pan
 * @property {GainNode} gain
 * @property {BiquadFilterNode} filter
 * @property {string} id
 * @property {HTMLMediaElement} el
 */
