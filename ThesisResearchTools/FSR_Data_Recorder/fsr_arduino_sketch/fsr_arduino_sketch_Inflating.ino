#include <Control_Surface.h>

USBMIDI_Interface midi;

// ── Config ─────────────────────────────────────────────────────────────
const int   FSR_PIN = A1;
const int   THRESHOLD = 100;        // trigger level (configurable)
const int   FSR_MAX = 4095;         // 12-bit ADC
const int   SMOOTHING_SAMPLES = 4;  // 200ms smoothing

const int   MAX_ACCUMULATION = 127; // cap at MIDI max
const int   INCREMENT_RANGE = 10;   // maps to 0-10 added per sample

// ── State ──────────────────────────────────────────────────────────────
int  smoothBuf[SMOOTHING_SAMPLES] = {0};
int  smoothIdx = 0;

bool wasAboveThreshold = false;
int  peakForce = 0;
int  currentCCValue = 0;
int  accumulatedValue = 0;
bool isPressActive = false;
bool isDecaying = false;

int  pressSampleCount = 0;  // count samples during active press
unsigned long decayStartTime = 0;
float decayRate = 0.0f;  // decrement per millisecond

int  currentCC = 1;  // CC channel (1 or 2)

// ── Rolling average smoothing ──────────────────────────────────────────
int pushAndAverage(int* buf, int size, int* idx, int newVal) {
  buf[*idx] = newVal;
  *idx = (*idx + 1) % size;

  long sum = 0;
  for (int i = 0; i < size; i++) sum += buf[i];

  return (int)(sum / size);
}

// ── Map raw force to 0-10 increment ────────────────────────────────────
int forceToIncrement(int force) {
  // Clamp to THRESHOLD → FSR_MAX range
  int clamped = constrain(force, THRESHOLD, FSR_MAX);
  
  // Map to 0-10 range for adding
  float normalized = (float)(clamped - THRESHOLD) / (float)(FSR_MAX - THRESHOLD);
  return (int)(normalized * INCREMENT_RANGE);
}

// ── Calculate decay rate based on press duration (fewer samples = faster decay)
float calculateDecayRate(int sampleCount) {
  // Map number of samples to decay rate
  // Fewer samples (short press) = faster decay
  // More samples (long press) = slower decay
  
  // Typical range: 10-500 samples (100ms to 5 seconds at 10ms per loop)
  // Normalize sample count: 10 samples → 1.0, 500 samples → 0.1
  float normalizedSamples = constrain((float)sampleCount / 500.0f, 0.1f, 1.0f);
  
  // Invert: more samples = slower decay
  // Fast decay: 2.0 MIDI units per ms (short press)
  // Slow decay: 0.2 MIDI units per ms (long press)
  float decayPerMs = 0.8f - (normalizedSamples * 0.0005f);  // 0.0005 to 0.8
  
  return decayPerMs;
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

  Serial.println("--- FSR Inflating Accumulator Ready ---");
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
    isDecaying = false;
    peakForce = smoothed;
    pressSampleCount = 0;  // reset sample counter

    Serial.println(">>> PRESS START <<<");
  }

  // Falling edge: force goes below threshold
  if (smoothed < THRESHOLD && wasAboveThreshold) {
    wasAboveThreshold = false;
    isPressActive = false;
    isDecaying = true;
    
    // Calculate decay rate based on press duration (number of samples collected)
    decayRate = calculateDecayRate(pressSampleCount);
    decayStartTime = millis();
    
    Serial.print(">>> PRESS END | Samples: ");
    Serial.print(pressSampleCount);
    Serial.print(" | Peak: ");
    Serial.print(peakForce);
    Serial.print(" | Decay Rate: ");
    Serial.print(decayRate);
    Serial.print(" MIDI/ms <<<");
    Serial.println();
  }

  // ── Track peak during active press ─────────────────────────────────
  if (isPressActive) {
    if (smoothed > peakForce) {
      peakForce = smoothed;
    }
    pressSampleCount++;  // increment sample count each loop during press
  }

  // ── Accumulation or Decay logic ────────────────────────────────────
  if (isPressActive) {
    // During press: ADD increment to accumulated value
    int increment = forceToIncrement(smoothed);
    accumulatedValue = constrain(accumulatedValue + increment, 0, MAX_ACCUMULATION);
    
  } else if (isDecaying && accumulatedValue > 0) {
    // After release: decay gradually
    unsigned long elapsedMs = millis() - decayStartTime;
    int targetValue = MAX(0, (int)(accumulatedValue - (decayRate * elapsedMs)));
    
    if (targetValue <= 0) {
      accumulatedValue = 0;
      isDecaying = false;
      Serial.println(">>> DECAY COMPLETE <<<");
    } else {
      accumulatedValue = targetValue;
    }
  }

  // ── MIDI output ────────────────────────────────────────────────────
  if (accumulatedValue != currentCCValue) {
    midi.sendControlChange(currentCC, accumulatedValue);
    currentCCValue = accumulatedValue;
    
    Serial.print("CC");
    Serial.print(currentCC);
    Serial.print(": ");
    Serial.print(accumulatedValue);
    Serial.print(" | Raw: ");
    Serial.print(smoothed);
    Serial.print(" | State: ");
    Serial.println(isPressActive ? "PRESS" : (isDecaying ? "DECAY" : "IDLE"));
  }

  delay(10);
}
