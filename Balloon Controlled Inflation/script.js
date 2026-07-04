import * as Util from './util.js';
import { scalePercent } from 'https://cdn.jsdelivr.net/npm/ixfx@1.38.1/dist/numbers.js';
import { Easings, Envelopes, cubicBezierShape } from 'https://cdn.jsdelivr.net/npm/ixfx@1.38.1/dist/modulation.js';
const settings = Object.freeze({
  // Key we want to monitor
  key: `f`,
  // Function to update HTML element
  info: Util.textContent(`#info`),
  // How often to update visuals based on state
  updateIntervalMs: 100,
  vis: document.getElementById("vis"),
  shape: cubicBezierShape(1.24, -1.15),
  envelope: new Envelopes.Adsr({
    attackDuration: 1000,
    decayDuration: 200,
    sustainDuration: 100,
    sustainLevel: 1,
    releaseLevel: 0.7
  })
});

/**
 * @typedef {{
 * pressed: boolean
*  repeating: boolean
*  lastPress: number
*  lastRelease: number
*  startPress:number
*  clicks:number
*  position:number
 * }} State
 */

/** @type State */
let state = Object.freeze({
  pressed: false,
  repeating: false,
  lastPress: 0,
  lastRelease: 0,
  startPress: 0,
  clicks: 0,
  position: 0
});


const use = () => {
  const { info, vis, envelope} = settings;
  const { pressed, startPress, clicks } = state;
  const scalarVar = Easings.Named.cubicIn(clicks * 0.1);
  const scalarVar2 = Easings.get(`quintin`);
  const element = document.querySelector(`#vis`);
  // force();
  console.log(envelope.value);
  var position = 0;
  var scale = 0;
  var opacity = 0;
  var e = scalarVar2(clicks*0.1);
  if (!element) return;
  console.log(clicks);
  if (pressed) {
    // Eg: if being held down, for how long
    const holdTime = Math.round(performance.now() - startPress);
    // info(`Number of Clicks: ${clicks}`);
  } else{
    force();
  }
  // console.log(scalarVar);
  position = scalePercent(scalarVar, 1, window.innerWidth-1);
  scale = scalePercent(e, 1, 4);
  opacity = scalePercent(e, 1, 0);
  vis.style = `margin-left: ${position}px;` + `scale:${scale};` + `background-color: hsla(0, 87%, 56%,  ${opacity});`;
  // console.log(e);
  if (pressed) {
    element.classList.add(`pressed`);
  } else {
    element.classList.remove(`pressed`);
  }
};

const onKeyDown = () => {
  const { key,envelope } = settings;
  let { pressed, startPress, clicks } = state;
  envelope.trigger(true);
  var eV = envelope.value;
  console.log(eV);

  // if(envelope.isDone){}
  clicks += eV;
  if (clicks > 10)
    clicks = 0;
  // Update state
  saveState({
    // We're in keydown, so yes pressed
    pressed: true,
    // Track the time of this event
    lastPress: performance.now(),
    startPress,
    clicks
  });
};

const onKeyUp = () => {
  const {envelope} = settings
  if(envelope.isDone){
    force();
  }
// console.log('Kebab');
  saveState({
    pressed: false,
  });
};
/**
 * Key is released
 * @param {KeyboardEvent} event 
 * @returns 
 */

function force() {
  let { clicks } = state;
  if (clicks >= 0.05)
    clicks -= 0.05;
  saveState({
    clicks
  });
};

/**
 * Listen for key events
 */
function setup() {
  document.addEventListener(`pointerdown`, onKeyDown);
  document.addEventListener(`pointerup`, onKeyUp);
  setInterval(use, settings.updateIntervalMs);
};

setup();


/**
 * Update state
 * @param {Partial<state>} s 
 */
function saveState(s) {
  state = Object.freeze({
    ...state,
    ...s
  });
}


