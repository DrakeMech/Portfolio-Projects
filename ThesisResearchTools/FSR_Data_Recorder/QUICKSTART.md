# FSR Data Recorder - Quick Start Guide

## Step 1: Arduino Setup
1. Open Arduino IDE
2. Open `fsr_arduino_sketch.ino` in this folder
3. Connect your Arduino Nano 33 BLE to USB
4. Select Board: Arduino > Arduino Nano 33 BLE
5. Select Port: COM port where Arduino is connected
6. Click Upload
7. Verify in Serial Monitor (Tools > Serial Monitor @ 9600 baud) that you see raw values when pressing FSR

## Step 2: Install Python Dependencies
Double-click `run.bat` OR open Command Prompt in this folder and run:
```
pip install -r requirements.txt
```

## Step 3: Run the Application
Double-click `run.bat` OR run:
```
python fsr_recorder.py
```

## Step 4: Record Your First Session

### Example: Freeform Surface
```
1. COM Port: Select the port where Arduino is connected (e.g., COM3)
2. Baud Rate: Keep as 9600
3. Click "Connect" → should turn green
4. Material Type: "Freeform"
5. Click "Start Recording"
6. Apply steady pressure to FSR for 5-10 seconds
7. Release pressure
8. Click "Stop Recording"
9. Click "Save as JSON"
10. File saved as: Freeform_20250406_143022.json
```

### Repeat for Other Materials
- Elastic Surface: Click "Start Recording", test elastic material
- Plastic Surface: Click "Start Recording", test plastic material

## Step 5: Use Data on Website
1. Go to your FSR website (with the upload interface)
2. Under "Freeform" section, click "Upload JSON Data"
3. Select `Freeform_20250406_143022.json`
4. The graph loads automatically

## File Output Example

When you save, you get a JSON file like this:

```json
[
  {"time": 0, "force": 32},
  {"time": 50, "force": 145},
  {"time": 100, "force": 203},
  {"time": 150, "force": 198},
  {"time": 200, "force": 156},
  {"time": 250, "force": 45},
  {"time": 300, "force": 0}
]
```

- **time**: How many milliseconds have passed (0 = start)
- **force**: Raw FSR reading (0-4095)

## Tips for Good Data
- Record 5-10 seconds per material
- Apply steady, constant pressure
- Test with different materials
- Save multiple samples to understand variation


## Troubleshooting Quick Links

**"No COM ports?"** → Arduino not connected or driver missing
**"Connection Failed"** → Close Arduino IDE Serial Monitor, try different port
**"No data points?"** → Verify FSR readings in Arduino IDE Serial Monitor first

Need more help? See README.md for detailed troubleshooting.
