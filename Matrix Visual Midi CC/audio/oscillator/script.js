import { scaleClamped, scalePercent } from 'ixfx/numbers.js';
import * as Osc from './oscillator.js';

const settings = Object.freeze({
  /**
   * HTML Element for setting pitch with pointer movement
   */
  freqAreaElement: /** @type HTMLElement */(document.querySelector(`#freqArea`)),
  /** 
   * Settings for oscillator
   * @type Osc.Options
   */
  oscillator: {
    type: `sawtooth`,
    frequency: 440
  },
  // Min/max of frequency range
  freqRange: [120, 1000]
});

/** 
 * @typedef {Readonly<{
 *  audio:Osc.BasicAudio|undefined
 *  x: number
 *  y: number
 * }>} State  
 */

/** @type State */
let state = {
  audio: undefined,
  x: 0.5,
  y: 0.5
};

/**
 * Use the current state.
 * In this sketch that's setting oscillator frequency and audio gain according to scaled state values.
 * @returns 
 */
const use = () => {
  const { freqRange } = settings;
  const { x, y } = state;

  const audio = initAudio();
  if (!audio) return;

  // Scale 0..1 to desired frequency range from settings
  const freq = scalePercent(x, freqRange[0], freqRange[1]);

  // Gain can use 0..1 range, no need to scale
  const level = y;

  const { ctx, gain, osc } = audio;

  // Set frequency (based on x)
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  // Set volume (based on y)
  gain.gain.setValueAtTime(level, ctx.currentTime);
};

const muteOscillator = () => {
  if (!state.audio) return; // Haven't initialised yet

  // Initialise if we haven't already
  const audio = initAudio();
  if (!audio) return;

  const { gain, ctx } = audio;

  gain.gain.setValueAtTime(0, ctx.currentTime);
};

/**
 * Pointer has moved in '#freqArea'
 * @param {Event} event 
 * @returns 
 */
const pointermove = (event) => {
  const { freqAreaElement } = settings;
  const pointerEvent = /** @type PointerEvent */(event);

  // No button press
  if (!pointerEvent.buttons) return;

  // Size of DOM element
  const bounds = freqAreaElement.getBoundingClientRect();

  // Calculate relative x,y
  const x = scaleClamped(pointerEvent.offsetX, 0, bounds.width);
  const y = scaleClamped(pointerEvent.offsetY, 0, bounds.height);

  // Set to state and use state
  saveState({ x, y });
  use();
};

/**
 * Initialise audio
 * @returns BasicAudio
 */
function initAudio() {
  const { oscillator } = settings;
  let { audio } = state;

  // Already initialised
  if (audio) return audio;

  // Create audio context (see oscillator.js)
  audio = Osc.create(oscillator);

  // Mute oscillator
  audio.gain.gain.setValueAtTime(0, audio.ctx.currentTime);

  // Start oscillator
  audio.osc.start();

  saveState({ audio });
  return audio;
}

function setup() {
  const { freqAreaElement } = settings;
  freqAreaElement.addEventListener(`pointerup`, muteOscillator);
  freqAreaElement.addEventListener(`pointerleave`, muteOscillator);
  freqAreaElement.addEventListener(`pointermove`, pointermove);
};
setup();

/**
 * Save state
 * @param {Partial<State>} s 
 */
function saveState(s) {
  state = Object.freeze({
    ...state,
    ...s
  });
  return state;
}
