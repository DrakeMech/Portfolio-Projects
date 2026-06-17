# SensorDataV2 - Generic Scheme


### Baseline Framework

```
┌────────────────────┐
│       Physical     │
│       Sensors      │
└──────────┬─────────┘
           │
           ↓
┌─────────────────────┐
│   sensorData.py     │  → Reads sensors, publishes via WebSocket
└──────────┬──────────┘
           │
    ┌──────┴────────────────────────────┐
    ↓                                   ↓
┌─────────────────────┐      ┌──────────────────────┐
│  launcher/          │      │  web/                │
│  websocket_handler  │      │  (Transformation     │
│  (receives data)    │      │   development)       │
└──────────┬──────────┘      └──────────────────────┘
           │
           ↓
┌─────────────────────┐
│  mapping.py         │  → Applies transformations
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  MIDI CC Output     │  → Sends to synthesizers, controllers, etc.
└─────────────────────┘

┌────────────────────────┐
│  transformations/      │  ← Both launcher & web use these
│  builtIn.py            │
│  custom.py (editable)  │
└────────────────────────┘
```

### Workflow

1. **Launcher (Desktop App)**
   - Displays real-time sensor data
   - Shows incoming values with min/max/avg statistics
   - Manages all **mappings** (sensor → MIDI CC signals)
   - Applies transformations to sensor values
   - Sends MIDI CC messages

2. **Web App (Transformation Editor)**
   - Edit custom transformation functions
   - View built-in transformations for reference
   - Code is saved locally in browser (localStorage)
   - Update the `transformations/custom.py` file for launcher to use

3. **Transformations Folder**
   - `builtIn.py`: Reference implementations (don't edit)
   - `custom.py`: **YOUR EDITABLE** transformation code
   - Both launcher and web editor reference these same files

## Running It

### Start Everything

```bash
# In SensorDataV2 folder:
python launcher/launcher.py
```

This will:
- Launch the CustomTkinter control panel
- Start the sensorData.py server (sensor readings)
- Start HTTP server for web UI
- Listen for WebSocket sensor data

### Open Web Editor

In launcher, click **"Open Transformation Editor"** or visit:
```
http://localhost:8080/index.html
```

## Creating Transformations

### 1. Define in `transformations/custom.py`

```python
"""
Custom transformations - edit this file!
"""

def my_cool_transform(value):
    """Scale sensor value logarithmically."""
    import math
    if value <= 0:
        return 0
    normalized = value / 127.0
    curved = (math.log(normalized) / math.log(0.001)) * 127
    return max(0, min(127, int(curved)))
```

### 2. Use in Launcher

1. Edit `transformations/custom.py`
2. Open launcher desktop app
3. Click **"Create Mapping"**
4. Select your transformation from the dropdown
5. Sensor data now uses your transformation!

### 3. Test in Web UI

- Visit transformation editor
- See your code in the custom transformations section
- Test logic by creating launchers mappings with real data

## File Responsibilities

| File | Responsibility |
|------|-----------------|
| `launcher.py` | CustomTkinter UI, process management |
| `monitor.py` | Real-time state tracking, statistics |
| `mapping.py` | Sensor→MIDI mappings, transformation application |
| `websocket_handler.py` | WebSocket connection, data reception |
| `builtIn.py` | Reference transformations (read-only) |
| `custom.py` | **User transformations** (EDIT THIS!) |
| `index.html` | Web UI for transformation development |
| `transformationEditor.js` | Browser-side logic |

---

**Next Steps:** Open `transformations/custom.py` to start defining your transformations!

**Still Ongoing Work** 
For now this is still incomplete I am keeping it as a misc and something to try out! Maybe someone is interested in trying it out!