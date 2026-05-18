#include <Control_Surface.h>

USBMIDI_Interface midi;

// ── Config ─────────────────────────────────────────────────────────────
const int   FSR_PIN = A1;

const int   THRESHOLD = 150;        // trigger level for spike detection
const int   TAP_MAX_DURATION = 100; // ms (tap must be shorter than this)
const int   TAP_MIN_AMPLITUDE = 300;

const int   FSR_MAX = 3500;

const int   WINDOW_SAMPLES = 4;     // 200ms smoothing
const int   LONGTERM_SAMPLES = 20;  // 1 sec smoothing
const float ADAPT_FLOOR = 0.25f;

// ── State ──────────────────────────────────────────────────────────────
int  shortBuf[WINDOW_SAMPLES] = {0};
int  longBuf[LONGTERM_SAMPLES] = {0};
int  shortIdx = 0;
int  longIdx = 0;

bool pressed = false;
int  lastCC = -1;

// Tap detection state
bool wasBelowThreshold = true;
unsigned long spikeStart = 0;
int peakValue = 0;
unsigned long lastTapTime = 0;
const int TAP_COOLDOWN = 500; // 0.5 second
int currentCC = 1;  // start with CC1

// ── Rolling average ────────────────────────────────────────────────────
int pushAndAverage(int* buf, int size, int* idx, int newVal) {
  buf[*idx] = newVal;
  *idx = (*idx + 1) % size;

  long sum = 0;
  for (int i = 0; i < size; i++) sum += buf[i];

  return (int)(sum / size);
}

// ── Adaptive CC mapping ────────────────────────────────────────────────
int adaptiveLogCC(int avg, int longAvg) {

  int adaptiveCeil = AH::max(
    (int)(ADAPT_FLOOR * FSR_MAX),
    constrain(longAvg * 3, THRESHOLD * 2, FSR_MAX)
  );

  int clamped = constrain(avg, THRESHOLD, adaptiveCeil);

  float Val = (float)(clamped - THRESHOLD + 1);
  float Max = (float)(adaptiveCeil - THRESHOLD + 1);

  if (Max < 0.001f) return 0;

  float norm = Val / Max;
  return (int)(norm * 127.0f);
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

  Serial.println("--- FSR Ready ---");
}

// ── Loop ───────────────────────────────────────────────────────────────
void loop() {
  Control_Surface.loop();

  int raw      = analogRead(FSR_PIN);
  int shortAvg = pushAndAverage(shortBuf, WINDOW_SAMPLES, &shortIdx, raw);

  // ── Long-term average (only when pressing)
  int longAvg;
  if (shortAvg >= THRESHOLD) {
    longAvg = pushAndAverage(longBuf, LONGTERM_SAMPLES, &longIdx, shortAvg);
  } else {
    long sum = 0;
    for (int i = 0; i < LONGTERM_SAMPLES; i++) sum += longBuf[i];
    longAvg = (int)(sum / LONGTERM_SAMPLES);
  }

  pressed = (shortAvg >= THRESHOLD);

  // Rising edge → start of spike
  if (raw > THRESHOLD && wasBelowThreshold) {
    spikeStart = millis();
    peakValue = raw;
    wasBelowThreshold = false;
  }

  // Track peak while spike is active
  if (!wasBelowThreshold) {
    if (raw > peakValue) peakValue = raw;
  }

  // Falling edge → evaluate spike
  if (raw < THRESHOLD && !wasBelowThreshold) {

    unsigned long duration = millis() - spikeStart;

    if (duration < TAP_MAX_DURATION && peakValue > TAP_MIN_AMPLITUDE) {

    unsigned long now = millis();

    if (now - lastTapTime > TAP_COOLDOWN) {
      toggleCC();
      Serial.print("Switched to CC");
      Serial.println(currentCC);
      lastTapTime = now;
    }
  }

    wasBelowThreshold = true;
  }

  if (pressed) {
    int cc = adaptiveLogCC(shortAvg, longAvg);

    if (cc != lastCC) {
      midi.sendControlChange(currentCC, cc);
      lastCC = cc;
    }
  } else {
    if (lastCC != 0) {
      midi.sendControlChange(currentCC, 0);
      lastCC = 0;
    }
  }

  // // ── Debug ─────────────────────────────────────────────────────
  //  Serial.print(raw);
  // Serial.print(" | Avg: ");  Serial.print(shortAvg);
  // Serial.print(" | Long: "); Serial.print(longAvg);
  // Serial.print(" | Peak: "); Serial.print(peakValue);
  // Serial.print(" | Pressed: "); Serial.print(pressed);
  // Serial.println();


  delay(10);
}