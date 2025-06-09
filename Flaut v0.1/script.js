import { parse } from './midi/midi.js';

if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: false }).then(onMIDISuccess, onMIDIFailure);
} else {
    alert("Web MIDI API not supported in this browser.");
}

function onMIDISuccess(midiAccess) {
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
        document.getElementById('button').style.backgroundColor = '#ff5722'; // Example action
        setTimeout(() => {
            document.getElementById('button').style.backgroundColor = '#4CAF50';
        }, 200);
    }
}