import { Espruino } from 'https://unpkg.com/ixfx/dist/io.js';
import { catchCall} from './getPokemon.js';
// Paste your puck code here
const puckCode = `
setTimeout(() => {
  Puck.on('accel', function(a) {
    if(a.acc.x >= 8000 || a.acc.x <= -8000)
    Bluetooth.println(JSON.stringify({motionDetected: true}));
    else 
    // Bluetooth.println(JSON.stringify({motionDetected: false}));
    console.log(a);
  });
  },100);
  
  Puck.accelOn(1.6);
`

let state = Object.freeze({
  puck: null,
});

const settings = Object.freeze({
  device: `Puck.js 9c90`, // Put in the name of your device here, eg `Puck.js a123`
  connectButton: document.querySelector(`#connect-button`),
});

/**
 * Update state
 * @param {Partial<state>} s 
 */
function updateState(s) {
  state = Object.freeze({ ...state, ...s });
}


/**
 * Save state to localStorage
 * @param {Partial<state>} s 
 */
function onData(event) {
  const { puck } = state;

  // Don't even try to parse if it doesn't
  // look like JSON
  const data = event.data.trim(); // Remove line breaks etc
  // console.log(data);
  if (!data.startsWith(`{`)) return;
  if (!data.endsWith(`}`)) return;

  // So far so good, try to parse as JSON
  try {
    const d = JSON.parse(data);
    console.log(d);
    //whenever the data is sending the motionDetected being true
    if (d.motionDetected) {
     console.log("movement detected");
    //turns On the Red Led and the Green one Off
    puck.write(`digitalWrite(LED1,1)\n`);
    puck.write(`digitalWrite(LED2,0)\n`);
    //calls the cathing function that was exported from the getPokemon.js
     catchCall();
    };
    setTimeout(()=>{
      //Does the oposite of the previous snippet of code
      puck.write(`digitalWrite(LED1,0)\n`);
    puck.write(`digitalWrite(LED2,1)\n`);
     },4800);

  } catch (error) {
    console.warn(error);
  }
};

function onFail(error) {
  const message = error?.message || String(error);
  console.error(`Failed to connect to device: ${message}`);

  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    console.error('Web Bluetooth is not available in this browser context. Open this page from http://localhost or https:// in Chrome or Edge.');
    return;
  }

  if (message.includes('requestDevice')) {
    console.error('The browser blocked the Bluetooth picker. Make sure Bluetooth permission is allowed and the page is running from localhost or HTTPS.');
  }
}

function onConnect(puck) {
  console.log(`Connected to device!`);

  updateState({ puck });
  puck.writeScript(puckCode);
  puck.addEventListener(`data`, onData);
  return puck;
}

// Connect to a device
async function connect() {
  console.log("Connecting to device...");

  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    onFail(new Error('Web Bluetooth is not available in this browser context. Use Chrome or Edge on localhost or HTTPS.'));
    return;
  }

  if (typeof Espruino?.puck !== 'function') {
    onFail(new Error('The Espruino Bluetooth helper is not available.'));
    return;
  }

  // Filter by name, if defined in settings
  const options = settings.device.length > 0 ? { name: settings.device } : {};

  // Connect to Puck
  Espruino.puck(options)
    .then(onConnect)
    .catch(onFail);
};

// Run once when the page is loaded
function setup() {
  const { connectButton } = settings;

  // Add a click event listener to the connect button
  connectButton.addEventListener(`click`, connect);
};

setup();