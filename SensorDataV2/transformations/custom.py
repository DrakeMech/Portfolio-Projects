"""
Custom transformation functions - EDIT THIS FILE to define your own transformations.

Each function should:
- Accept a value parameter (and optional named parameters)
- Return an integer between 0-127 (MIDI CC range)
- Include a docstring explaining what it does

Examples are provided below. Add your own transformations here.
"""


# ============================================================================
# EXAMPLE: Uncomment and modify to create custom transformations
# ============================================================================

# def myCustomTransform(value):
#     """
#     Example custom transformation.
#     Replace this with your own logic.
#     """
#     return max(0, min(127, int(value)))


# def xy_distance(x, y):
#     """
#     Calculate distance from origin given X and Y coordinates.
#     """
#     import math
#     dist = math.sqrt(x*x + y*y)
#     return max(0, min(127, int(dist * 10)))


# def map_to_range(value, in_min, in_max, out_min, out_max):
#     """
#     Map value from one range to another.
#     """
#     if in_max <= in_min:
#         return out_min
#     ratio = (value - in_min) / (in_max - in_min)
#     result = out_min + (ratio * (out_max - out_min))
#     return max(0, min(127, int(result)))


# ============================================================================
# ADD YOUR CUSTOM TRANSFORMATIONS BELOW THIS LINE
# ============================================================================

def my_custom_transform(sensor1, sensor2, strength=1.0):
    """Combine two sensors with custom logic."""
    combined = (sensor1 + sensor2) * strength
    return max(0, min(127, int(combined * 127)))
