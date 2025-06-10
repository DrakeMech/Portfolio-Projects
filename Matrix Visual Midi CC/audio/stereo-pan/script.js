import { scaleClamped } from 'ixfx/numbers.js';
import { Oscillators } from 'ixfx/modulation.js';
import { repeat } from 'ixfx/flow.js';
import { Audio } from '../audio.js';

const settings = Object.freeze({
  audioId: `rainstorm`,
  audio: new Audio(),
  autoPanRate: 0.2,
  autoPanUpdateRateMs: 2
});

/**
 * @typedef {Readonly<{
 * pan: number
 * readingAutoPan: boolean
 * }>} State
 */

/** @type State */
let state = Object.freeze({
  pan: 0, // -1 to 1,
  readingAutoPan: false
});

const use = () => {
  const { audio, audioId } = settings;
  const a = audio.get(audioId);
  if (!a) return;

  const { pan } = state;
  // Eg to set the pan value at a designated time...
  //a.pan.pan.setValueAtTime(pan, a.ctx.currentTime);
  a.pan.pan.value = pan;
};


const play = () => {
  const { audio, audioId } = settings;
  const a = audio.get(audioId);
  if (!a) {
    console.log(`Could not find AUDIO element with id '${audioId}'`);
    return;
  }
  const { el } = a;

  // Ensure playing & looping
  el.loop = true;
  el.play();
};


const stop = () => {
  const { audio, audioId } = settings;
  const a = audio.get(audioId);
  if (!a) {
    console.log(`Could not find AUDIO element with id '${audioId}'`);
    return;
  }
  const { el } = a;
  el.pause();
};

const autoStart = async () => {
  const { audio, autoPanRate, autoPanUpdateRateMs } = settings;
  if (state.readingAutoPan) return; // Already running
  audio.init();

  saveState({ readingAutoPan: true });
  const autoPan = Oscillators.sine(autoPanRate);
  play();
  for await (const v of repeat(autoPan, { delay: autoPanUpdateRateMs })) {
    // Value from oscillator will be 0..1. We need -1...1
    const pan = scaleClamped(v, 0, 1, -1, 1);
    saveState({ pan });
    use();
    if (!state.readingAutoPan) break;
  }
};

const autoStop = () => {
  saveState({ readingAutoPan: false });
};

const random = () => {
  const { audio, audioId } = settings;
  const a = audio.get(audioId);
  if (!a) {
    console.log(`Could not find AUDIO element with id '${audioId}'`);
    return;
  }

  saveState({ readingAutoPan: false });
  play();

  // Random value of -1 to 1
  saveState({ pan: Math.random() * 2 - 1 });
  use();
};

/**
 * Pointer is in the panning area
 * @param {Event} event
 */
const pointerArea = (event) => {
  const pointerEvent = /** @type PointerEvent */(event);

  // Size of pan area element
  const bounds = /** @type HTMLElement */(event.target).getBoundingClientRect();

  // Compute relative value: -1..1
  const pan = scaleClamped(pointerEvent.x, 0, bounds.width, -1, 1);

  // But we want -1 to 1 range
  saveState({ pan });
  use();
};
function setup() {
  // Set pan to a random value
  document.querySelector(`#btnRandom`)?.addEventListener(`click`, random);

  // Stops playback (or rather, pauses it)
  document.querySelector(`#btnStop`)?.addEventListener(`click`, stop);

  // If there's a click in pan area rectangle, start playback
  document.querySelector(`#panArea`)?.addEventListener(`click`, event => {
    play();
  });

  // Pointer is moving inside rectangle, setting pan
  document.querySelector(`#panArea`)?.addEventListener(`pointermove`, pointerArea);

  // Start/stop automatic panning using an oscillator
  document.querySelector(`#btnAutoStart`)?.addEventListener(`click`, autoStart);
  document.querySelector(`#btnAutoStop`)?.addEventListener(`click`, autoStop);

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
