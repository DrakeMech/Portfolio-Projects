# FSR Data Recorder

A Python GUI application for recording Force Sensitive Resistor (FSR) sensor data from Arduino over USB serial connection. 

# Considerations
This was written and commented using Copilot. I was just lazy writing it by hand since it's overall information that I might have missed for whoever wants to use it. 

## Features

- **Live Serial Connection**: Connect to Arduino via COM port with configurable baud rate
- **Real-time Visualization**: Graph FSR readings as data comes in
- **Session Management**: Record data for different materials (Freeform, Elastic Surface, Plastic Surface)
- **JSON Export**: Save recorded data in JSON format compatible with your website
- **Data Statistics**: Display min, max, average force values and duration
- **Multi-session Support**: Easy switching between material types

## Requirements

- Python 3.7+
- Arduino with FSR sensor connected (using the provided sketch)
- USB cable connection between Arduino and computer

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```
2. Just execute run.bat (I wrote that so you wont bother running all of these lines, it saves time in my oppinon)

## Usage

1. **Upload the Arduino Sketch**
   - Upload the provided FSR Arduino code to your Arduino board
   - Verify the FSR is connected to pin A1

2. **Run the Application**
   ```bash
   python fsr_recorder.py
   ```

3. **Connect to Arduino**
   - Select your COM port from the dropdown (e.g., COM3, COM4)
   - Select baud rate (default: 9600)
   - Click "Connect"
   - Status should show green when connected

4. **Record Data**
   - Select material type: Freeform, Elastic Surface, or Plastic Surface
   - Click "Start Recording"
   - Apply pressure to the FSR sensor
   - The graph updates in real-time
   - Click "Stop Recording" when finished

5. **Save Data**
   - Click "Save as JSON"
   - File is automatically saved in the same folder with format: `Material_Type_YYYYMMDD_HHMMSS.json`
   - Each file contains an array of readings: `[{time: ms, force: rawValue}, ...]`

## JSON Format

Saved files follow the format expected by your website:

```json
[
  {
    "time": 0,
    "force": 45
  },
  {
    "time": 50,
    "force": 128
  },
  {
    "time": 100,
    "force": 156
  }
]
```

- **time**: Elapsed time in milliseconds from start of recording
- **force**: Raw FSR value (0-4095 for 12-bit Arduino Nano 33 BLE)

## Troubleshooting

### No COM ports showing
- Ensure Arduino is connected via USB
- Check Device Manager to see available COM ports
- May need USB driver installation

### Connection fails
- Verify baud rate matches Arduino code (default 9600)
- Close other serial monitors (Arduino IDE, etc.)
- Try different COM port if available

### No data recording
- Verify FSR sensor is working (watch Serial Monitor in Arduino IDE)
- Ensure Arduino sketch is properly uploaded
- Check pin A1 connection

### Graph not updating
- Application may be waiting for serial data
- Try applying pressure to FSR
- Check serial connection status

## Upload to Website

The saved JSON files are ready to use with your website:
1. Go to your website
2. Select the material type (Freeform, Elastic Surface, or Plastic Surface)
3. Click "Upload JSON Data"
4. Select the saved JSON file
5. Graph will display