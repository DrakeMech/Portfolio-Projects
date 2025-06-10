import { parse } from './midi/midi.js';

let midiOutput = null;
let xyMode = false;

if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: false }).then(onMIDISuccess, onMIDIFailure);
} else {
    alert("Web MIDI API not supported in this browser.");
}

function onMIDISuccess(midiAccess) {
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
        console.log("C3 Note On received");
    }
}

const buttonX = document.getElementById('button-x');
const buttonY = document.getElementById('button-y');
const buttonXY = document.getElementById('button-xy');

// Toggle XY mode on buttonXY click
buttonXY.addEventListener('click', () => {
    xyMode = !xyMode;
    buttonXY.textContent = xyMode ? 'XY Mode: ON' : 'XY Mode: OFF';
});

// Helper to map pointer position to MIDI CC value (0-127)
function mapToCC(val, min, max) {
    return Math.max(0, Math.min(127, Math.round(((val - min) / (max - min)) * 127)));
}

// Send MIDI CC message
function sendCC(cc, value) {
    if (midiOutput) {
        midiOutput.send([0xB0, cc, value]);
    }
}

function sendNoteOn(note = 48, velocity = 127) {
    if (midiOutput) {
        midiOutput.send([0x90, note, velocity]);
    }
}

function sendNoteOff(note = 48) {
    if (midiOutput) {
        midiOutput.send([0x80, note, 0]);
    }
}

// X Only: pointermove over button-x
buttonX.addEventListener('pointermove', (e) => {
    if (e.pressure > 0) {
        const rect = buttonX.getBoundingClientRect();
        const x = mapToCC(e.clientX, rect.left, rect.right);
        sendCC(1, x); // CC 1 = X
    }
});

// Y Only: pointermove over button-y
buttonY.addEventListener('pointermove', (e) => {
    if (e.pressure > 0) {
        const rect = buttonY.getBoundingClientRect();
        const y = mapToCC(e.clientY, rect.top, rect.bottom);
        sendCC(2, y); // CC 2 = Y
    }
});

// XY Mode: pointermove anywhere on the document (when xyMode is ON)
document.addEventListener('pointermove', (e) => {
    if (xyMode) {
        // Use the window dimensions for mapping
        const x = mapToCC(e.clientX, 0, window.innerWidth);
        const y = mapToCC(e.clientY, 0, window.innerHeight);
        sendCC(1, x); // CC 1 = X
        sendCC(2, y); // CC 2 = Y
    }
});

    document.addEventListener('pointerdown', () => sendNoteOn());
    document.addEventListener('pointerup', () => sendNoteOff());
    document.addEventListener('pointerleave', () => sendNoteOff());

const circles = [
    { el: document.getElementById('circle-tl'), x: 0, y: 0, baseHue: 0 },     // Red
    { el: document.getElementById('circle-tr'), x: 1, y: 0, baseHue: 120 },   // Green
    { el: document.getElementById('circle-bl'), x: 0, y: 1, baseHue: 240 },   // Blue
    { el: document.getElementById('circle-br'), x: 1, y: 1, baseHue: 45 }     // Yellow/Orange
];

let pointerDown = false;
let pointerPos = { x: 0, y: 0 };

document.addEventListener('pointerdown', e => {
    pointerDown = true;
    pointerPos = { x: e.clientX, y: e.clientY };
});
document.addEventListener('pointerup', () => pointerDown = false);

document.addEventListener('pointermove', e => {
    pointerPos = { x: e.clientX, y: e.clientY };
});

function lerp(a, b, t) { return a + (b - a) * t; }

function animateCircles(ts) {
    const w = window.innerWidth, h = window.innerHeight;
    const freqBoost = pointerDown ? 2 : 1; // Double frequency when pointer is down

    circles.forEach((c, i) => {
        // Corner positions
        const cx = c.x === 0 ? 60 : w - 60;
        const cy = c.y === 0 ? 60 : h - 60;
        // Distance from pointer to corner (normalized 0..1)
        const dx = (pointerPos.x - cx) / w;
        const dy = (pointerPos.y - cy) / h;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const proximity = Math.max(0, 1 - dist * 2); // 1 = close, 0 = far

        // Oscillation frequency (Hz) increases as you get closer and when pointer is down
        const freq = lerp(0.5, 3 + i, proximity);
        const size = 160 + Math.sin(ts/200 * freq + i) * 10 * proximity;

        // Color: base hue, saturation increases as you get closer
        const sat = lerp(40, 90, proximity);
        c.el.style.background = `hsl(${c.baseHue}, ${sat}%, 60%)`;
        c.el.style.width = c.el.style.height = size + "px";
        c.el.style.left = (c.x === 0 ? 20 : w - size - 20) + "px";
        c.el.style.top  = (c.y === 0 ? 20 : h - size - 20) + "px";
        c.el.style.filter = "brightness(1.2)";
        c.el.style.zIndex = pointerDown ? 10 : 1;
        c.el.style.opacity = pointerDown ? 1 : 0.7;
    });
    requestAnimationFrame(animateCircles);
}
requestAnimationFrame(animateCircles);