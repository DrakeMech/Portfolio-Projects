#include <Control_Surface.h>

USBMIDI_Interface midi;

// ── Config ─────────────────────────────────────────────────────────────
const int   FSR_PIN = A1;
const int   THRESHOLD = 100;        // trigger level (configurable)
const int   FSR_MAX = 4095;         // 12-bit ADC
const int   SMOOTHING_SAMPLES = 4;  // 200ms smoothing

// ── State ──────────────────────────────────────────────────────────────
int  smoothBuf[SMOOTHING_SAMPLES] = {0};
int  smoothIdx = 0;

bool wasAboveThreshold = false;
int  peakForce = 0;
int  currentCCValue = 0;
int  heldPeakValue = 0;
bool isPressActive = false;

int  currentCC = 1;  // CC channel (1 or 2)

// ── Rolling average smoothing ──────────────────────────────────────────
int pushAndAverage(int* buf, int size, int* idx, int newVal) {
  buf[*idx] = newVal;
  *idx = (*idx + 1) % size;

  long sum = 0;
  for (int i = 0; i < size; i++) sum += buf[i];

  return (int)(sum / size);
}

// ── Map raw force to 0-127 MIDI range ──────────────────────────────────
int forceToMIDI(int force) {
  // Clamp to THRESHOLD → FSR_MAX range
  int clamped = constrain(force, THRESHOLD, FSR_MAX);
  
  // Map to 0-127
  float normalized = (float)(clamped - THRESHOLD) / (float)(FSR_MAX - THRESHOLD);
  return (int)(normalized * 127.0f);
}

void toggleCC() {
  currentCC = (currentCC == 1) ? 2 : 1;
}

// ── Setup ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  delay(1000);

  analogReadResolution(12);  // 0–4095
  Control_Surface.begin();

  Serial.println("--- FSR Peak Hold Ready ---");
  Serial.print("Threshold: ");
  Serial.println(THRESHOLD);
}

// ── Loop ───────────────────────────────────────────────────────────────
void loop() {
  Control_Surface.loop();

  int raw = analogRead(FSR_PIN);
  int smoothed = pushAndAverage(smoothBuf, SMOOTHING_SAMPLES, &smoothIdx, raw);

  // ── Threshold crossing detection ────────────────────────────────────
  // Rising edge: force goes above threshold
  if (smoothed >= THRESHOLD && !wasAboveThreshold) {
    wasAboveThreshold = true;
    isPressActive = true;
    peakForce = smoothed;
    heldPeakValue = 0;

    Serial.println(">>> PRESS START <<<");
  }

  // Falling edge: force goes below threshold
  if (smoothed < THRESHOLD && wasAboveThreshold) {
    wasAboveThreshold = false;
    isPressActive = false;
    
    // Lock in the peak value
    heldPeakValue = forceToMIDI(peakForce);
    
    Serial.print(">>> PEAK CAPTURED: ");
    Serial.print(peakForce);
    Serial.print(" (MIDI: ");
    Serial.print(heldPeakValue);
    Serial.println(") <<<");
  }

  // ── Track peak during active press ─────────────────────────────────
  if (isPressActive) {
    if (smoothed > peakForce) {
      peakForce = smoothed;
    }
  }

  // ── MIDI output ────────────────────────────────────────────────────
  int ccValueToSend = 0;

  if (isPressActive) {
    // During press: send live mapped force
    ccValueToSend = forceToMIDI(smoothed);
  } else if (heldPeakValue > 0) {
    // After release: send held peak value
    ccValueToSend = heldPeakValue;
  }

  // Only send if value changed
  if (ccValueToSend != currentCCValue) {
    midi.sendControlChange(currentCC, ccValueToSend);
    currentCCValue = ccValueToSend;
    
    Serial.print("CC");
    Serial.print(currentCC);
    Serial.print(": ");
    Serial.print(ccValueToSend);
    Serial.print(" | Raw: ");
    Serial.println(smoothed);
  }

  delay(10);
}
