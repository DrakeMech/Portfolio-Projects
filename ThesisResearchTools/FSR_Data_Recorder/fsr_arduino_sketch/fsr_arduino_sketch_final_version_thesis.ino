/*
  FSR MULTI-INPUT — Final Version Thesis
  6 FSR inputs: A1–A6
    - A1 → adaptive CC with tap-toggle (CC1↔CC2)
    - A2 → adaptive CC only (CC3)
    - A3 → inflating accumulation behavior (CC4)
    - A4 → adaptive CC only (CC5)
    - A5 → adaptive CC only (CC6)
    - A6 → peakhold behavior (CC7)

  Each channel maintains independent state and behavior.
*/

#include <Control_Surface.h>

USBMIDI_Interface midi;

// ── Config ────────────────────────────────────────────────────────────────────
const int NUM_CH             = 6;
const int FSR_PINS[NUM_CH]   = { A1, A2, A3, A4, A5, A6 };

// Behavior type for each channel: 0=adaptive, 1=inflating, 2=peakhold
const int BEHAVIOR[NUM_CH]   = { 0, 0, 1, 0, 0, 2 };

// Fixed CC number for each channel
const int CC_NUMBER[NUM_CH]  = { 1, 3, 4, 5, 6, 7 };

// Secondary CC for A1 tap-toggle
const int CC_PAIR[NUM_CH][2] = {
  {1, 2},    // A1 (tap toggles)
  {3, 3},    // A2 (fixed)
  {4, 4},    // A3 (fixed)
  {5, 5},    // A4 (fixed)
  {6, 6},    // A5 (fixed)
  {7, 7},    // A6 (fixed)
};

// ── Adaptive CC config ────────────────────────────────────────────────────────
const int   THRESHOLD        = 150;   // ADC units — not pressed below this
const int   FSR_MAX          = 3500;  // physical ceiling
const float ADAPT_FLOOR      = 0.25f; // adaptive ceil never below 25% of FSR_MAX
const int   WINDOW_SAMPLES   = 4;     // short avg (~20 ms at 5 ms/loop)
const int   LONGTERM_SAMPLES = 20;    // long avg (~100 ms)

// Tap detection (A1 only)
const unsigned long TAP_MAX_MS  = 100;  // spike must be shorter than this
const int           TAP_MIN_AMP = 600;  // peak ADC value during spike
const unsigned long TAP_COOLDOWN = 500; // ms between recognised taps

// ── Inflating config (A3) ─────────────────────────────────────────────────────
const int   INFLATING_THRESHOLD  = 100;   // A3 specific threshold
const int   INFLATING_FSR_MAX    = 4095;  // A3 specific FSR max (12-bit)
const int   MAX_ACCUMULATION     = 127;   // cap at MIDI max
const int   INCREMENT_RANGE      = 10;    // maps to 0-10 added per sample

// ── Peakhold config (A6) ──────────────────────────────────────────────────────
const int   PEAKHOLD_THRESHOLD = 100;
const int   PEAKHOLD_FSR_MAX = 4095;

// ── Per-channel state — Adaptive CC (A1, A2, A4, A5) ──────────────────────────
int  shortBuf[NUM_CH][WINDOW_SAMPLES];
int  longBuf[NUM_CH][LONGTERM_SAMPLES];
int  shortIdx[NUM_CH];
int  longIdx[NUM_CH];
int  lastCC[NUM_CH];

// ── Per-channel state — Tap toggle (A1 only) ─────────────────────────────────
bool         wasBelowThreshold[NUM_CH];
unsigned long spikeStart[NUM_CH];
int           peakValue[NUM_CH];
unsigned long lastTapTime[NUM_CH];
int           tapToggle[NUM_CH];

// ── Per-channel state — Inflating (A3) ────────────────────────────────────────
bool         isPressActive_Inflating[NUM_CH];
bool         isDecaying_Inflating[NUM_CH];
int          accumulatedValue[NUM_CH];
int          pressSampleCount[NUM_CH];
unsigned long decayStartTime_Inflating[NUM_CH];
float        decayRate_Inflating[NUM_CH];

// ── Per-channel state — Peakhold (A6) ─────────────────────────────────────────
bool         isPressActive_Peakhold[NUM_CH];
int          peakForce_Peakhold[NUM_CH];
int          heldPeakValue_Peakhold[NUM_CH];
bool         wasBelowThreshold_Peakhold[NUM_CH];

// ── Helpers ───────────────────────────────────────────────────────────────────
int pushAndAverage(int* buf, int size, int* idx, int newVal) {
  buf[*idx] = newVal;
  *idx = (*idx + 1) % size;
  long sum = 0;
  for (int i = 0; i < size; i++) sum += buf[i];
  return (int)(sum / size);
}

int bufAverage(int* buf, int size) {
  long sum = 0;
  for (int i = 0; i < size; i++) sum += buf[i];
  return (int)(sum / size);
}

// ── Adaptive CC mapping ───────────────────────────────────────────────────────
int adaptiveCC(int avg, int longAvg) {
  int adaptiveCeil = AH::max(
    (int)(ADAPT_FLOOR * FSR_MAX),
    constrain(longAvg * 3, THRESHOLD * 2, FSR_MAX)
  );
  int clamped = constrain(avg, THRESHOLD, adaptiveCeil);
  float Val = (float)(clamped - THRESHOLD + 1);
  float Max = (float)(adaptiveCeil - THRESHOLD + 1);
  if (Max < 0.001f) return 0;
  return (int)((Val / Max) * 127.0f);
}

// ── Inflating: map raw force to 0-10 increment ────────────────────────────────
int forceToIncrement(int force) {
  int clamped = constrain(force, INFLATING_THRESHOLD, INFLATING_FSR_MAX);
  float normalized = (float)(clamped - INFLATING_THRESHOLD) / (float)(INFLATING_FSR_MAX - INFLATING_THRESHOLD);
  return (int)(normalized * INCREMENT_RANGE);
}

// ── Inflating: calculate decay rate based on press duration ────────────────────
float calculateDecayRate(int sampleCount) {
  // Map sample count to decay rate:
  // Short press (few samples) = faster decay (higher value like 0.05)
  // Long press (many samples) = slower decay (lower value like 0.0005)
  
  // Normalize: clamp between 10 and 500 samples
  float normalizedSamples = constrain((float)sampleCount / 500.0f, 0.02f, 1.0f);
  
  // Map inversely to decay rate
  // 1.0 normalized (500+ samples) → 0.0005 (slow decay)
  // 0.02 normalized (10 samples) → 0.05 (fast decay)
  float decayPerMs = 0.05f * (1.0f - normalizedSamples) + 0.0005f * normalizedSamples;
  
  return decayPerMs;
}

// ── Peakhold: map raw force to 0-127 MIDI range ───────────────────────────────
int forceToMIDI_Peakhold(int force) {
  int clamped = constrain(force, PEAKHOLD_THRESHOLD, PEAKHOLD_FSR_MAX);
  float normalized = (float)(clamped - PEAKHOLD_THRESHOLD) / (float)(PEAKHOLD_FSR_MAX - PEAKHOLD_THRESHOLD);
  return (int)(normalized * 127.0f);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  delay(1000);
  analogReadResolution(12);
  Control_Surface.begin();

  // Zero all per-channel arrays
  for (int ch = 0; ch < NUM_CH; ch++) {
    for (int i = 0; i < WINDOW_SAMPLES;   i++) shortBuf[ch][i] = 0;
    for (int i = 0; i < LONGTERM_SAMPLES; i++) longBuf[ch][i]  = 0;
    shortIdx[ch]          = 0;
    longIdx[ch]           = 0;
    lastCC[ch]            = -1;
    wasBelowThreshold[ch] = true;
    spikeStart[ch]        = 0;
    peakValue[ch]         = 0;
    lastTapTime[ch]       = 0;
    tapToggle[ch]         = 0;

    // Inflating state
    isPressActive_Inflating[ch] = false;
    isDecaying_Inflating[ch] = false;
    accumulatedValue[ch] = 0;
    pressSampleCount[ch] = 0;
    decayStartTime_Inflating[ch] = 0;
    decayRate_Inflating[ch] = 0.0f;

    // Peakhold state
    isPressActive_Peakhold[ch] = false;
    peakForce_Peakhold[ch] = 0;
    heldPeakValue_Peakhold[ch] = 0;
    wasBelowThreshold_Peakhold[ch] = true;
  }

  Serial.println("--- FSR Final Version Thesis Ready (A1-A6) ---");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  Control_Surface.loop();
  unsigned long now = millis();

  for (int ch = 0; ch < NUM_CH; ch++) {

    int raw = analogRead(FSR_PINS[ch]);

    // ── Route to behavior handler ─────────────────────────────────────────────
    if (BEHAVIOR[ch] == 0) {
      // Adaptive CC (A1, A2, A4, A5)
      handleAdaptiveCC(ch, raw, now);
    } else if (BEHAVIOR[ch] == 1) {
      // Inflating accumulation (A3)
      handleInflating(ch, raw);
    } else if (BEHAVIOR[ch] == 2) {
      // Peakhold (A6)
      handlePeakhold(ch, raw);
    }
  }

  // ── Debug output (optional) ───────────────────────────────────────────────
  printDebugInfo();

  delay(5);
}

// ── Handle Adaptive CC (A1, A2, A4, A5) ──────────────────────────────────────
void handleAdaptiveCC(int ch, int raw, unsigned long now) {
  int shortAvg = pushAndAverage(shortBuf[ch], WINDOW_SAMPLES, &shortIdx[ch], raw);
  int longAvg;

  if (shortAvg >= THRESHOLD) {
    longAvg = pushAndAverage(longBuf[ch], LONGTERM_SAMPLES, &longIdx[ch], shortAvg);
  } else {
    longAvg = bufAverage(longBuf[ch], LONGTERM_SAMPLES);
  }

  bool pressed = (shortAvg >= THRESHOLD);

  // ── Tap detection (A1 only) ──────────────────────────────────────────────
  if (ch == 0) {  // A1
    // Rising edge
    if (raw > THRESHOLD && wasBelowThreshold[ch]) {
      spikeStart[ch] = now;
      peakValue[ch] = raw;
      wasBelowThreshold[ch] = false;
    }

    // Track peak during spike
    if (!wasBelowThreshold[ch] && raw > peakValue[ch]) {
      peakValue[ch] = raw;
    }

    // Falling edge → evaluate
    if (raw < THRESHOLD && !wasBelowThreshold[ch]) {
      unsigned long dur = now - spikeStart[ch];
      if (dur < TAP_MAX_MS && peakValue[ch] > TAP_MIN_AMP) {
        if (now - lastTapTime[ch] > TAP_COOLDOWN) {
          tapToggle[ch] = 1 - tapToggle[ch];
          lastTapTime[ch] = now;
          Serial.print("A1 → CC"); Serial.println(CC_PAIR[ch][tapToggle[ch]]);
        }
      }
      wasBelowThreshold[ch] = true;
    }
  }

  // ── CC output ────────────────────────────────────────────────────────────
  int ccNum = CC_PAIR[ch][tapToggle[ch]];

  if (pressed) {
    int ccVal = adaptiveCC(shortAvg, longAvg);
    if (ccVal != lastCC[ch]) {
      midi.sendControlChange(ccNum, ccVal);
      lastCC[ch] = ccVal;
    }
  } else {
    if (lastCC[ch] != 0) {
      midi.sendControlChange(ccNum, 0);
      lastCC[ch] = 0;
    }
  }
}

// ── Handle Inflating (A3) ─────────────────────────────────────────────────────
void handleInflating(int ch, int raw) {
  int shortAvg = pushAndAverage(shortBuf[ch], WINDOW_SAMPLES, &shortIdx[ch], raw);

  // ── Threshold crossing detection ──────────────────────────────────────────
  // Rising edge
  if (shortAvg >= INFLATING_THRESHOLD && !isPressActive_Inflating[ch]) {
    isPressActive_Inflating[ch] = true;
    isDecaying_Inflating[ch] = false;
    accumulatedValue[ch] = 0;  // Reset peak for this press
    pressSampleCount[ch] = 0;
    Serial.print("A3 PRESS START");
    Serial.println();
  }

  // Falling edge
  if (shortAvg < INFLATING_THRESHOLD && isPressActive_Inflating[ch]) {
    isPressActive_Inflating[ch] = false;
    isDecaying_Inflating[ch] = true;
    decayRate_Inflating[ch] = calculateDecayRate(pressSampleCount[ch]);
    decayStartTime_Inflating[ch] = millis();
    Serial.print("A3 PRESS END | Peak: ");
    Serial.print(accumulatedValue[ch]);
    Serial.print(" | Samples: ");
    Serial.print(pressSampleCount[ch]);
    Serial.print(" | Decay Rate: ");
    Serial.println(decayRate_Inflating[ch]);
  }

  // ── Track peak during active press ─────────────────────────────────────────
  if (isPressActive_Inflating[ch]) {
    if (shortAvg > accumulatedValue[ch]) {
      accumulatedValue[ch] = shortAvg;
    }
    pressSampleCount[ch]++;
    
    // Debug output during press
    Serial.print("A3 TRACKING | Raw: ");
    Serial.print(raw);
    Serial.print(" | ShortAvg: ");
    Serial.print(shortAvg);
    Serial.print(" | Peak: ");
    Serial.print(accumulatedValue[ch]);
    Serial.print(" | Samples: ");
    Serial.println(pressSampleCount[ch]);
  } 
  // ── Decay after release ────────────────────────────────────────────────────
  else if (isDecaying_Inflating[ch] && accumulatedValue[ch] > 0) {
    unsigned long elapsedMs = millis() - decayStartTime_Inflating[ch];
    int decayedValue = (int)(accumulatedValue[ch] - (decayRate_Inflating[ch] * elapsedMs));
    
    if (decayedValue <= 0) {
      accumulatedValue[ch] = 0;
      isDecaying_Inflating[ch] = false;
      Serial.println("A3 DECAY COMPLETE");
    } else {
      accumulatedValue[ch] = decayedValue;
      
      // Debug output during decay
      Serial.print("A3 DECAYING | Elapsed: ");
      Serial.print(elapsedMs);
      Serial.print("ms | DecayRate: ");
      Serial.print(decayRate_Inflating[ch]);
      Serial.print(" | Current: ");
      Serial.println(accumulatedValue[ch]);
    }
  }

  // ── MIDI output ──────────────────────────────────────────────────────────
  static int lastInflatingCC[NUM_CH] = {-1};
  // Map raw FSR value (INFLATING_THRESHOLD to INFLATING_FSR_MAX) to 0-127
  int ccValue = forceToMIDI_Peakhold(accumulatedValue[ch]);
  
  if (ccValue != lastInflatingCC[ch]) {
    midi.sendControlChange(CC_NUMBER[ch], ccValue);
    lastInflatingCC[ch] = ccValue;
  }
}

// ── Handle Peakhold (A6) ──────────────────────────────────────────────────────
void handlePeakhold(int ch, int raw) {
  int shortAvg = pushAndAverage(shortBuf[ch], WINDOW_SAMPLES, &shortIdx[ch], raw);

  // ── Threshold crossing detection ──────────────────────────────────────────
  // Rising edge
  if (shortAvg >= PEAKHOLD_THRESHOLD && !isPressActive_Peakhold[ch]) {
    isPressActive_Peakhold[ch] = true;
    peakForce_Peakhold[ch] = shortAvg;
    heldPeakValue_Peakhold[ch] = 0;
    Serial.println("A6 PRESS START");
  }

  // Falling edge
  if (shortAvg < PEAKHOLD_THRESHOLD && isPressActive_Peakhold[ch]) {
    isPressActive_Peakhold[ch] = false;
    heldPeakValue_Peakhold[ch] = forceToMIDI_Peakhold(peakForce_Peakhold[ch]);
    Serial.print("A6 PEAK CAPTURED: ");
    Serial.print(peakForce_Peakhold[ch]);
    Serial.print(" (MIDI: ");
    Serial.print(heldPeakValue_Peakhold[ch]);
    Serial.println(")");
  }

  // ── Track peak during active press ───────────────────────────────────────
  if (isPressActive_Peakhold[ch]) {
    if (shortAvg > peakForce_Peakhold[ch]) {
      peakForce_Peakhold[ch] = shortAvg;
    }
  }

  // ── MIDI output ──────────────────────────────────────────────────────────
  static int lastPeakholdCC[NUM_CH] = {-1};
  int ccValueToSend = 0;

  if (isPressActive_Peakhold[ch]) {
    ccValueToSend = forceToMIDI_Peakhold(shortAvg);
  } else if (heldPeakValue_Peakhold[ch] > 0) {
    ccValueToSend = heldPeakValue_Peakhold[ch];
  }

  if (ccValueToSend != lastPeakholdCC[ch]) {
    midi.sendControlChange(CC_NUMBER[ch], ccValueToSend);
    lastPeakholdCC[ch] = ccValueToSend;
  }
}

// ── Debug output ──────────────────────────────────────────────────────────────
void printDebugInfo() {
  // Uncomment to print raw values for debugging
  // Serial.print("[");
  // for (int ch = 0; ch < NUM_CH; ch++) {
  //   int raw = analogRead(FSR_PINS[ch]);
  //   Serial.print("A"); Serial.print(ch + 1);
  //   Serial.print(":"); Serial.print(raw);
  //   if (ch < NUM_CH - 1) Serial.print(", ");
  // }
  // Serial.println("]");
}
