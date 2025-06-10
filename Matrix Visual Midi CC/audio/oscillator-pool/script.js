import { Arrays, Pool } from 'ixfx/data.js';

import * as Audio from './audio.js';

const settings = Object.freeze({
  voices: Pool.create({
    // How many voices
    capacity: 5,
    // Call 'voiceAdded' to make a new voice,
    // 'voiceRemoved' to remove a voice
    generate: voiceAdded,
    free: voiceRemoved,
    // Clean up voices after 1s
    userExpireAfterMs: 1000,
    resourcesWithoutUserExpireAfterMs: 1000,
    fullPolicy: `evictOldestUser`
  })
});

/**
 * @typedef {Readonly<{
 *  context: AudioContext|undefined
 *  keysPressed:readonly string[]
 *  pointersPressed:readonly string[]
 * }>} State
 */

/** @type State */
let state = Object.freeze({
  // Audio context
  context: undefined,
  // Which keys are pressed (chars)
  keysPressed: [],
  // Which pointers are pressed (ids)
  pointersPressed: []
});

/**
 * Pool calls this to create a new pool resource
 * @returns
 */
function voiceAdded() {
  const context = getAudioContext();
  if (context === undefined) throw new Error(`AudioContext not available`);
  const a = Audio.create(context);
  return a;
}

/**
 * Pool calls this to remove a resource
 * @param {Audio.Thing} thing 
 */
function voiceRemoved(thing) {
  Audio.remove(thing);
}

const use = () => {
  const { voices } = settings;
  const { keysPressed, pointersPressed } = state;

  // Keep alive voices that are currently triggered
  const keys = [...keysPressed, ...pointersPressed];
  for (const key of keys) {
    voices.use(key);
  }
};

const update = () => {};

const getAudioContext = () => {
  let { context } = state;
  if (context !== undefined) return context;
  context = new AudioContext();
  saveState({ context });
  return context;
};

/**
 * When there's a keydown, add it to the list
 * @param {KeyboardEvent} event 
 */
const onKeyDown = (event) => {
  if (event.repeat) return; // Ignore repeat keydown events
  let { keysPressed } = state;

  // Add new key to list of keys being pressed,
  // making sure we don't add duplicates
  keysPressed = Arrays.unique([...keysPressed, event.key]);
  saveState({ keysPressed });
};

/**
 * When there's a pointer down, add its id to the list
 * @param {PointerEvent} event 
 */
const onPointerDown = (event) => {
  let { pointersPressed } = state;

  // Add to list of pointer ids, making sure we don't add duplicates
  pointersPressed = Arrays.unique([...pointersPressed, event.pointerId.toString()]);
  saveState({ pointersPressed });
};

/**
 * When there's a pointerup, remove from list
 * of pointerdown ids, and release voice from pool
 * @param {PointerEvent} event 
 */
const onPointerUp = (event) => {
  const { voices } = settings;
  let { pointersPressed } = state;

  // Remove this pointer from list of pointers being pressed
  pointersPressed = pointersPressed.filter(k => k !== event.pointerId.toString());

  // Release it from the pool
  voices.release(event.pointerId.toString());

  // Save the new list of pointers being pressed
  saveState({ pointersPressed });
};

/**
 * When there's a keyup, remove from list of held
 * keys and release voice
 * @param {KeyboardEvent} event 
 */
const onKeyUp = (event) => {
  const { voices } = settings;
  let { keysPressed } = state;

  // Remove this key from list of keys being pressed
  keysPressed = keysPressed.filter(k => k !== event.key);

  // Release it from the pool
  voices.release(event.key);

  // Save the neaw list of keys being pressed
  saveState({ keysPressed });
};

function setup() {
  document.addEventListener(`keydown`, onKeyDown);
  document.addEventListener(`keyup`, onKeyUp);
  document.addEventListener(`pointerdown`, onPointerDown);
  document.addEventListener(`pointerup`, onPointerUp);

  // Update all the pool resources
  setInterval(() => {
    for (const item of settings.voices.resources()) {
      let thing = item.data;
      // Updates the thing
      thing = Audio.update(thing);
      // Save the updated data back into the pool resource
      item.updateData(thing);
      // Use the updated data
      Audio.use(thing);
    }
  });

  // Run a regular update/use cycle
  setInterval(() => {
    update();
    use();
  }, 10);
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