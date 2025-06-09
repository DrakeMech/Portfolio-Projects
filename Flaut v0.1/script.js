import { parse } from './midi/midi.js';

let midiOutput = null;

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

button.addEventListener('mousedown', () => {
    if (midiOutput) {
        // Note On: channel 1, note 48 (C3), velocity 127
        midiOutput.send([0x90, 48, 127]);
        button.style.backgroundColor = '#ff5722';
    }
});

button.addEventListener('mouseup', () => {
    if (midiOutput) {
        // Note Off: channel 1, note 48 (C3), velocity 0
        midiOutput.send([0x80, 48, 0]);
        button.style.backgroundColor = '#4CAF50';
    }
});

// Also handle mouse leaving the button while holding
button.addEventListener('mouseleave', () => {
    if (midiOutput) {
        midiOutput.send([0x80, 48, 0]);
        button.style.backgroundColor = '#4CAF50';
    }
});
