/*
  FSR DATA RECORDER - Arduino Nano 33 BLE
  
  This sketch reads an FSR (Force Sensitive Resistor) sensor and sends
  raw analog values over Serial at 9600 baud.
  
  The FSR Data Recorder GUI application will capture these values,
  timestamp them, and allow you to save them as JSON files.
  
  Connect FSR to:
  - Analog Pin A1 (signal)
  - 5V (one terminal)
  - GND (through resistor or directly)
  
  See: https://learn.adafruit.com/force-sensitive-resistor-fsr
*/

#include <Control_Surface.h>

USBMIDI_Interface midi;

const int fsrPin    = A1;
const int threshold = 50;
bool pressed        = false;

void setup() {
  Serial.begin(9600);
  delay(1000);
  analogReadResolution(12);  // 0–4095 on Nano 33 BLE
  Control_Surface.begin();
  Serial.println("--- FSR Ready ---");
}

void pressingBool(int condition) {
  pressed = (condition >= threshold);
}

int midiCCMap(int value) {
  int clamped = constrain(value, threshold, 1800);
  return map(clamped, threshold, 1800, 0, 127);
}

void loop() {
  Control_Surface.loop();

  int rawValue = analogRead(fsrPin);

  // Send raw value - this is what the Data Recorder app captures
  Serial.println(rawValue);
  
  int midiSensor = midiCCMap(rawValue);
  pressingBool(rawValue);

  Serial.print("Raw: "); Serial.print(rawValue);
  Serial.print(" | MIDI CC: "); Serial.println(midiSensor);

  if (pressed) {
    midi.sendControlChange(1, midiSensor);
    Serial.print("Sent CC1: "); Serial.println(midiSensor);
  }

  delay(50);
}
