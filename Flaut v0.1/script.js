import { parse } from './midi/midi.js';

let midiOutput = null;
let serialPort = null;
let writer = null;

if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: false }).then(onMIDISuccess, onMIDIFailure);
} else {
    alert("Web MIDI API not supported in this browser.");
}

function onMIDISuccess(midiAccess) {
    // Select the first available output
    for (let output of midiAccess.outputs.values()) {
        midiOutput = output;
        break;
    }
    for (let input of midiAccess.inputs.values()) {
        input.onmidimessage = handleMIDIMessage;
    }
}

function onMIDIFailure() {
    alert("Could not access your MIDI devices.");
}

function handleMIDIMessage(event) {
    const msg = parse(event.data);
    if (msg && msg.command === 'noteon' && msg.note === 48) {
        // C3 triggered
        console.log("C3 Note On received");
        document.getElementById('button').style.backgroundColor = '#ff5722'; // Example action
        setTimeout(() => {
            document.getElementById('button').style.backgroundColor = '#4CAF50';
        }, 200);
    }
}

const button = document.getElementById('button');

// Request serial port access
async function connectSerial() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 31250 }); // Standard MIDI baud rate
        writer = serialPort.writable.getWriter();
        alert("Serial port connected!");
    } catch (err) {
        alert("Failed to connect to serial port: " + err);
    }
}

// Send MIDI message over serial
async function sendMIDI(bytes) {
    if (writer) {
        await writer.write(new Uint8Array(bytes));
    }
}

// Connect button (optional: only show if not connected)
document.body.insertAdjacentHTML('beforeend', '<button id="connect-serial">Connect Serial</button>');
document.getElementById('connect-serial').addEventListener('click', connectSerial);

button.addEventListener('mousedown', () => {
    // Note On: channel 1, note 48 (C3), velocity 127
    sendMIDI([0x90, 48, 127]);
    button.style.backgroundColor = '#ff5722';
});

button.addEventListener('mouseup', () => {
    // Note Off: channel 1, note 48 (C3), velocity 0
    sendMIDI([0x80, 48, 0]);
    button.style.backgroundColor = '#4CAF50';
});

button.addEventListener('mouseleave', () => {
    sendMIDI([0x80, 48, 0]);
    button.style.backgroundColor = '#4CAF50';
});
