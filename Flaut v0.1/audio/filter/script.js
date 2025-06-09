import { scaleClamped } from 'ixfx/numbers.js';
import { Oscillators } from 'ixfx/modulation.js';
import { repeat } from 'ixfx/flow.js';
import * as Random from 'ixfx/random.js';
import { Audio } from '../audio.js';

const settings = Object.freeze({
  audioId: `rainstorm`,
  autoFilterRate: 0.2,
  autoFilterUpdateRateMs: 2,
  /** @type {"allpass" | "bandpass" | "highpass" | "highshelf" | "lowpass" | "lowshelf" | "notch" | "peaking"} */
  filterType: `bandpass`,
  audio: new Audio()
});

/**
 * @typedef {Readonly<{
 *  filterFreq: number // filter freq in Hz
 *  filterQ: number
 *  readingAutoFilter: boolean
 * }>} State
 */

/** @type State */
let state = {
  filterFreq: 0,
  filterQ: 0,
  readingAutoFilter: false
};

/**
 * Use state
 * @param {State} state 
 * @returns 
 */
const use = (state) => {
  const { audioId, audio } = settings;
  const { filterFreq, filterQ } = state;

  const a = audio.get(audioId);
  if (!a) return; // No audio for some reason

  const { filter } = a;
  filter.frequency.value = filterFreq;
  //filter.Q.value = filterQ;
};

const play = () => {
  const { audioId, audio } = settings;
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

const randomFilter = () => {
  const { audioId, audio } = settings;
  const a = audio.get(audioId);
  if (!a) {
    console.log(`Could not find AUDIO element with id '${audioId}'`);
    return;
  }

  saveState({ readingAutoFilter: false });
  play();

  // Random value of 200Hz - 2kHz
  use(saveState({
    filterFreq: Random.integer({ min: 200, max: 2000 })
  }));
};

/**
 * Start moving the filter using an oscillator
 */
const autoStart = async () => {
  const { audio, autoFilterRate, autoFilterUpdateRateMs } = settings;
  let { readingAutoFilter } = state;
  if (readingAutoFilter) return; // Already running;

  saveState({ readingAutoFilter: true });
  audio.init();

  const autoPan = Oscillators.sine(autoFilterRate);
  play();
  for await (const v of repeat(autoPan, { delay: autoFilterUpdateRateMs })) {
    // Value from oscillator will be 0..1. We need 200Hz...2kHz
    const freq = scaleClamped(v, 0, 1, 200, 2000);
    use(saveState({ filterFreq: freq }));

    // If stop button has been pressed, exit out
    if (!state.readingAutoFilter) break;
  }
};

const autoStop = () => {
  saveState({ readingAutoFilter: false });
};

/**
 * 'pointermove' in #area element.
 * Updates the frequency based on relative X position within area
 * @param {PointerEvent|Event} event 
 */
const pointerInArea = (event) => {
  const { audio } = settings;
  const pointerEvent = /** @type PointerEvent */(event);

  audio.init();
  // Size of area element
  const bounds = /** @type HTMLElement */(event.target).getBoundingClientRect();

  // Compute relative value
  const freq = scaleClamped(pointerEvent.x, 0, bounds.width, 200, 2000);

  // But we want -1 to 1 range
  use(saveState({ filterFreq: freq }));
};

function setup() {
  // Set filter to a random value
  document.querySelector(`#btnRandom`)?.addEventListener(`click`, randomFilter);

  // Stops playback (or rather, pauses it)
  document.querySelector(`#btnStop`)?.addEventListener(`click`, stop);

  // Clicking within the area
  document.querySelector(`#area`)?.addEventListener(`click`, event => {
    play();
  });

  // Pointer move adjusts filter
  document.querySelector(`#area`)?.addEventListener(`pointermove`, pointerInArea);

  // Start using oscillator to move filter
  document.querySelector(`#btnAutoStart`)?.addEventListener(`click`, autoStart);
  // Stop using oscillator to move filter
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
