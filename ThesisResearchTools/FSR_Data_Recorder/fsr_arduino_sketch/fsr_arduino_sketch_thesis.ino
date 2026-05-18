/*
  FSR MULTI-INPUT — Arduino Nano 33 BLE
  6 FSR inputs: A1–A6
    - A1, A3, A5 → adaptive CC + tap-toggle (alternates between two CC numbers)
    - A2, A4, A6 → adaptive CC only

  Per-channel state is stored in arrays; the main loop iterates over all 6.
  Long-term average only advances while the sensor is pressed (noise immunity).
  Tap detection uses millis() so it is independent of loop delay.
*/

#include <Control_Surface.h>

USBMIDI_Interface midi;

// ── Config ────────────────────────────────────────────────────────────────────
const int NUM_CH             = 6;
const int FSR_PINS[NUM_CH]   = { A1, A2, A3, A4, A5, A6 };

// Which channels have tap-toggle (0-based index: 0=A1, 2=A3, 4=A5)
const bool HAS_TAP[NUM_CH]   = { true, false, true, false, true, false };

// CC pair for each channel: index[ch][0]=default, index[ch][1]=toggled
// A1 toggles CC1↔CC2, A2 fixed CC3, A3 toggles CC4↔CC5, A4 fixed CC6,
// A5 toggles CC7↔CC8, A6 fixed CC9
const int CC_PAIR[NUM_CH][2] = {
  {1,  2},   // A1  (tap toggles)
  {3,  3},   // A2  (no tap, both same)
  {4,  5},   // A3  (tap toggles)
  {6,  6},   // A4
  {7,  8},   // A5  (tap toggles)
  {9,  9},   // A6
};

const int   THRESHOLD        = 150;   // ADC units — not pressed below this
const int   FSR_MAX          = 3500;  // physical ceiling
const float ADAPT_FLOOR      = 0.25f; // adaptive ceil never below 25 % of FSR_MAX

const int   WINDOW_SAMPLES   = 4;     // short avg (~20 ms at 5 ms/loop)
const int   LONGTERM_SAMPLES = 20;    // long  avg (~100 ms)

// Tap detection
const unsigned long TAP_MAX_MS  = 100;  // spike must be shorter than this
const int           TAP_MIN_AMP = 600;  // peak ADC value during spike
const unsigned long TAP_COOLDOWN = 500; // ms between recognised taps

// ── Per-channel state ─────────────────────────────────────────────────────────
int  shortBuf[NUM_CH][WINDOW_SAMPLES];
int  longBuf[NUM_CH][LONGTERM_SAMPLES];
int  shortIdx[NUM_CH];
int  longIdx[NUM_CH];
int  lastCC[NUM_CH];

// Tap state
bool         wasBelowThreshold[NUM_CH];
unsigned long spikeStart[NUM_CH];
int           peakValue[NUM_CH];
unsigned long lastTapTime[NUM_CH];
int           tapToggle[NUM_CH];   // 0 or 1 → indexes CC_PAIR[ch]

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
  }

  Serial.println("--- FSR Multi Ready (A1-A6) ---");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  Control_Surface.loop();
  unsigned long now = millis();

  for (int ch = 0; ch < NUM_CH; ch++) {

    int raw      = analogRead(FSR_PINS[ch]);
    int shortAvg = pushAndAverage(shortBuf[ch], WINDOW_SAMPLES,   &shortIdx[ch], raw);
    int longAvg;

    if (shortAvg >= THRESHOLD) {
      longAvg = pushAndAverage(longBuf[ch], LONGTERM_SAMPLES, &longIdx[ch], shortAvg);
    } else {
      longAvg = bufAverage(longBuf[ch], LONGTERM_SAMPLES);
    }

    bool pressed = (shortAvg >= THRESHOLD);

    // ── Tap detection (only for channels with HAS_TAP) ──────────────────────
    if (HAS_TAP[ch]) {

      // Rising edge
      if (raw > THRESHOLD && wasBelowThreshold[ch]) {
        spikeStart[ch]        = now;
        peakValue[ch]         = raw;
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
            tapToggle[ch] = 1 - tapToggle[ch];   // flip 0↔1
            lastTapTime[ch] = now;
            Serial.print("A"); Serial.print(ch + 1);
            Serial.print(" → CC"); Serial.println(CC_PAIR[ch][tapToggle[ch]]);
          }
        }
        wasBelowThreshold[ch] = true;
      }
    }

    // ── CC output ───────────────────────────────────────────────────────────
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

  // ── Serial array output: [A1:raw/cc, A2:raw/cc, ...] ───────────────────────
  Serial.print("[");
  for (int ch = 0; ch < NUM_CH; ch++) {
    int raw = analogRead(FSR_PINS[ch]);
    Serial.print("A"); Serial.print(ch + 1);
    Serial.print(":"); Serial.print(raw);
    Serial.print("/"); Serial.print(lastCC[ch] < 0 ? 0 : lastCC[ch]);
    if (ch < NUM_CH - 1) Serial.print(", ");
  }
  Serial.println("]");

  delay(5);
}
