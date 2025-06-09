import { Audio } from '../audio.js';

const settings = Object.freeze({
  audio: new Audio(),
  sampleId: `rainstorm`
});

let state = Object.freeze({});

const use = () => {};

/**
 * Plays a sample by id.
 * The id should correspond to the HTML AUDIO element.
 * @param {string} id 
 * @returns 
 */
function playSample(id) {
  const { audio } = settings;
  const a = audio.get(id);
  if (!a) {
    console.log(`Could not find sample: ${id}`);
    return;
  }
  console.log(`Playing: ${id}`);
  a.el.play();
}

/**
 * Stops a sample by id.
 * The id should correspond to the HTML AUDIO element
 * @param {string} id 
 */
function stopSample(id) {
  const { audio } = settings;
  const a = audio.get(id);
  if (!a) {
    console.log(`Could not find sample: ${id}`);
    return;
  }
  console.log(`Stopped: ${id}`);
  a.el.pause();
}

function setup() {
  const { sampleId } = settings;

  // Call every half a second
  setInterval(use, 500);

  document.querySelector(`#btnPlay`)?.addEventListener(`click`, () => {
    playSample(sampleId);
  });
  document.querySelector(`#btnStop`)?.addEventListener(`click`, () => {
    stopSample(sampleId);
  });

};

/**
 * Save state
 * @param {Partial<state>} s 
 */
function saveState(s) {
  state = Object.freeze({
    ...state,
    ...s
  });
  return state;
}
setup();