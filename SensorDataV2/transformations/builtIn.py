"""
Built-in transformation functions for sensor data → MIDI CC mapping.
These are read-only reference implementations.
"""

def passthrough(value):
    """Return value as-is, clamped to 0-127."""
    return max(0, min(127, int(value)))


def normalize_to_cc(value, min_val=0, max_val=100):
    """
    Normalize value from a range to MIDI CC range (0-127).
    
    Args:
        value: Raw sensor value
        min_val: Expected minimum value
        max_val: Expected maximum value
    """
    if max_val <= min_val:
        return 0
    normalized = (value - min_val) / (max_val - min_val)
    cc_value = int(normalized * 127)
    return max(0, min(127, cc_value))


def threshold(value, threshold=50, below=0, above=127):
    """
    Binary transformation: return above/below certain threshold.
    
    Args:
        value: Raw sensor value
        threshold: Trigger threshold
        below: CC value if below threshold
        above: CC value if at or above threshold
    """
    return above if value >= threshold else below


def exponential_curve(value, factor=2.0):
    """
    Apply exponential curve to value (0-127).
    Higher factor = steeper curve.
    """
    normalized = value / 127.0
    curved = (normalized ** factor) * 127
    return max(0, min(127, int(curved)))


def logarithmic_curve(value, factor=1.0):
    """
    Apply logarithmic curve to value (0-127).
    Inverse of exponential.
    """
    import math
    if value <= 0:
        return 0
    normalized = value / 127.0
    # Avoid log(0), clamp to small value
    normalized = max(0.001, normalized)
    curved = (math.log(normalized) / math.log(0.001)) * 127
    return max(0, min(127, int(curved)))


def invert(value):
    """Invert value: 127 - value."""
    return max(0, min(127, 127 - int(value)))


def smooth_average(value, history_buffer):
    """
    Smooth value using moving average.
    
    Args:
        value: Current raw value
        history_buffer: List of previous values (max 10)
    """
    history_buffer.append(value)
    if len(history_buffer) > 10:
        history_buffer.pop(0)
    
    avg = sum(history_buffer) / len(history_buffer)
    return max(0, min(127, int(avg)))


def deadzone(value, deadzone_size=5):
    """
    Apply deadzone: values within range snap to 0, otherwise pass through.
    
    Args:
        value: Raw sensor value
        deadzone_size: Size of deadzone around 0
    """
    if abs(value) <= deadzone_size:
        return 0
    return max(0, min(127, int(value)))


# ============================================================================
# MULTI-INPUT TRANSFORMATIONS (combine multiple sensor sources)
# ============================================================================

def xy_to_cc(x, y, mode='magnitude'):
    """
    Convert X,Y coordinates to MIDI CC using various combining modes.
    
    Args:
        x: X coordinate (normalized 0-1)
        y: Y coordinate (normalized 0-1)
        mode: 'magnitude' (distance), 'mix' (x+y), 'max' (max of x,y), 'x' or 'y'
    """
    x = float(x)
    y = float(y)
    
    if mode == 'magnitude':
        # Euclidean distance
        import math
        magnitude = math.sqrt(x**2 + y**2) / math.sqrt(2)  # Normalize to 0-1
        return max(0, min(127, int(magnitude * 127)))
    elif mode == 'mix':
        # Average of x and y
        mixed = (x + y) / 2
        return max(0, min(127, int(mixed * 127)))
    elif mode == 'max':
        # Maximum of x and y
        return max(0, min(127, int(max(x, y) * 127)))
    elif mode == 'x':
        return max(0, min(127, int(x * 127)))
    elif mode == 'y':
        return max(0, min(127, int(y * 127)))
    else:
        return int(x * 127)


def amplified_by_sensor(primary_value, amplifier_value, amplifier_factor=1.0):
    """
    Use one sensor to amplify another sensor's response.
    Example: touch response amplified by magnetometer strength.
    
    Args:
        primary_value: Main sensor value (0-1)
        amplifier_value: Amplifier sensor value (0-1)
        amplifier_factor: How much the amplifier affects (default 1.0 = linear)
    """
    primary = float(primary_value)
    amplifier = float(amplifier_value)
    factor = float(amplifier_factor)
    
    # Amplified response: primary * (amplifier ^ factor)
    amplified = primary * (amplifier ** (factor / 10.0))  # Soften the exponent
    return max(0, min(127, int(amplified * 127)))


def combined_motion(x, y, z, weight_xy=0.6, weight_z=0.4):
    """
    Combine XY motion (e.g., touch) with Z motion (e.g., pressure/accelerometer).
    
    Args:
        x, y, z: Sensor coordinates
        weight_xy: How much to weight XY component (0-1)
        weight_z: How much to weight Z component (0-1)
    """
    import math
    
    x, y, z = float(x), float(y), float(z)
    
    # XY magnitude
    xy_mag = math.sqrt(x**2 + y**2) / math.sqrt(2)
    
    # Normalize z
    z_normalized = abs(z)
    
    # Weighted combination
    combined = (xy_mag * weight_xy) + (z_normalized * weight_z)
    return max(0, min(127, int(combined * 127)))


def sensor_blend(value1, value2, blend_amount=0.5):
    """
    Blend between two sensor values.
    
    Args:
        value1: First sensor value
        value2: Second sensor value
        blend_amount: 0.0 = only value1, 0.5 = equal mix, 1.0 = only value2
    """
    v1 = float(value1)
    v2 = float(value2)
    blend = float(blend_amount)
    
    result = (v1 * (1 - blend)) + (v2 * blend)
    return max(0, min(127, int(result * 127)))


def velocity_from_motion(x_current, y_current, x_prev=0, y_prev=0):
    """
    Calculate velocity (rate of change) from motion.
    Useful for getting "speed" of touch or motion.
    
    Args:
        x_current, y_current: Current position
        x_prev, y_prev: Previous position (from last frame)
    """
    import math
    
    x_c, y_c = float(x_current), float(y_current)
    x_p, y_p = float(x_prev), float(y_prev)
    
    # Distance traveled since last update
    distance = math.sqrt((x_c - x_p)**2 + (y_c - y_p)**2)
    
    # Clamp to CC range
    velocity_cc = min(127, int(distance * 500))  # Tunable sensitivity
    return velocity_cc

