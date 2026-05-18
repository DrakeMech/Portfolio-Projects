"""
Sensor → MIDI mapping management.
Handles creating, tracking, and applying transformations to mappings.
"""

from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path so we can import transformations
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from transformations import builtIn, custom


class Mapping:
    """Represents a sensor → MIDI CC mapping (supports single or multi-input)."""
    
    def __init__(self, mapping_id, sensor_address=None, cc_number=None, transformation_name=None, transformation_params=None, input_sources=None):
        """
        Args:
            mapping_id: Unique identifier
            sensor_address: (deprecated) Single sensor address for backward compatibility
            input_sources: List of (address, metric_name) tuples for multi-input
                          e.g., [("/touch1", "x"), ("/touch1", "y"), ("/magnetometer", "z")]
            cc_number: MIDI CC number (0-127)
            transformation_name: Name of transformation to apply
            transformation_params: Dict of parameters for transformation
        """
        self.id = mapping_id
        self.cc_number = cc_number
        self.transformation_name = transformation_name or "passthrough"
        self.transformation_params = transformation_params or {}
        self.enabled = True
        self.created_at = datetime.now()
        self.last_cc_sent = None
        self.last_update_time = None
        
        # Support both old single-input and new multi-input format
        if input_sources:
            self.input_sources = input_sources  # List of (address, metric) tuples
        elif sensor_address:
            # Backward compatibility: convert single address to input format
            # E.g., "/accelerometer/x" → [("/accelerometer", "x")]
            parts = sensor_address.strip('/').split('/')
            if len(parts) == 2:
                addr, metric = parts
                self.input_sources = [(f"/{addr}", metric)]
            else:
                # Fallback for addresses like "/touch1" → [("/touch1", "value")]
                self.input_sources = [(sensor_address, "value")]
        else:
            self.input_sources = []
        
        # For backward compatibility
        self.sensor_address = sensor_address
        
        # History: list of (timestamp, cc_value) tuples (max 100 entries)
        self.cc_history = []
        self.value_history = []  # (timestamp, input_values_dict) for reference
    
    def get_required_inputs(self):
        """Return list of required (address, metric) pairs for this mapping."""
        return self.input_sources
    
    def apply_transformation(self, input_values_dict):
        """
        Apply the mapped transformation to sensor values.
        
        Args:
            input_values_dict: Dict of {(address, metric): value} or {metric_name: value}
                              For single-input: can also be a single number
            
        Returns:
            MIDI CC value (0-127)
        """
        if not self.enabled:
            return None
        
        # Get transformation function
        transform_func = self._get_transformation_function()
        if not transform_func:
            return None
        
        try:
            # Handle different input formats
            if isinstance(input_values_dict, (int, float)):
                # Single value (backward compatibility)
                result = transform_func(input_values_dict, **self.transformation_params)
            elif isinstance(input_values_dict, dict):
                # Multi-input: pass as keyword arguments
                # Convert {(addr, metric): val} to {metric: val} or {name: val}
                kwargs = dict(self.transformation_params)
                
                # If dict keys are (address, metric) tuples, extract the metric name
                if input_values_dict and isinstance(next(iter(input_values_dict.keys())), tuple):
                    for (addr, metric), val in input_values_dict.items():
                        kwargs[metric] = val
                else:
                    # Direct metric names
                    kwargs.update(input_values_dict)
                
                result = transform_func(**kwargs)
            else:
                return None
            
            cc_value = max(0, min(127, int(result)))
            
            # Track timing
            now = datetime.now()
            self.last_cc_sent = cc_value
            self.last_update_time = now
            
            # Store in history with timestamp
            self.cc_history.append((now, cc_value))
            self.value_history.append((now, input_values_dict))
            
            # Limit history to last 100 entries
            if len(self.cc_history) > 100:
                self.cc_history.pop(0)
            if len(self.value_history) > 100:
                self.value_history.pop(0)
            
            return cc_value
        except Exception as e:
            print(f"Error applying transformation {self.transformation_name}: {e}")
            return None
    
    def _get_transformation_function(self):
        """Get the transformation function from builtIn or custom modules."""
        # Try built-in transformations first
        if hasattr(builtIn, self.transformation_name):
            return getattr(builtIn, self.transformation_name)
        
        # Try custom transformations
        if hasattr(custom, self.transformation_name):
            return getattr(custom, self.transformation_name)
        
        print(f"Transformation '{self.transformation_name}' not found")
        return None
    
    def get_cc_stats(self):
        """
        Calculate statistics about CC output over time.
        
        Returns:
            Dict with min, max, avg, current, and rate of change
        """
        if not self.cc_history:
            return {
                "min": 0,
                "max": 0,
                "avg": 0,
                "current": 0,
                "rate_of_change": 0,
                "updates": 0,
                "duration_seconds": 0
            }
        
        cc_values = [v for _, v in self.cc_history]
        
        # Calculate rate of change (CC/second)
        rate_of_change = 0
        if len(self.cc_history) >= 2:
            first_time, first_val = self.cc_history[0]
            last_time, last_val = self.cc_history[-1]
            duration = (last_time - first_time).total_seconds()
            if duration > 0:
                rate_of_change = (last_val - first_val) / duration
        
        duration_seconds = (self.last_update_time - self.created_at).total_seconds() if self.last_update_time else 0
        
        return {
            "min": min(cc_values),
            "max": max(cc_values),
            "avg": sum(cc_values) / len(cc_values),
            "current": cc_values[-1] if cc_values else 0,
            "rate_of_change": round(rate_of_change, 3),  # CC/second
            "updates": len(self.cc_history),
            "duration_seconds": round(duration_seconds, 2)
        }
    
    def get_history_since(self, seconds_ago):
        """
        Get CC values from the last N seconds.
        
        Args:
            seconds_ago: How far back to retrieve (in seconds)
            
        Returns:
            List of (timestamp, cc_value) tuples
        """
        if not self.last_update_time:
            return []
        
        cutoff_time = self.last_update_time - timedelta(seconds=seconds_ago)
        return [(t, v) for t, v in self.cc_history if t >= cutoff_time]
    
    
    def to_dict(self):
        """Convert mapping to dict for serialization."""
        stats = self.get_cc_stats()
        return {
            "id": self.id,
            "sensor_address": self.sensor_address,
            "cc_number": self.cc_number,
            "transformation_name": self.transformation_name,
            "transformation_params": self.transformation_params,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat(),
            "last_update_time": self.last_update_time.isoformat() if self.last_update_time else None,
            "last_cc_sent": self.last_cc_sent,
            "stats": stats
        }


class MappingManager:
    """Manages all active sensor → MIDI mappings (single and multi-input)."""
    
    def __init__(self):
        self.mappings = {}  # { mapping_id: Mapping }
        self.next_id = 1
        
        # Cache of sensor state: {(address, metric_name): value}
        # E.g., {("/touch1", "x"): 0.5, ("/touch1", "y"): 0.7, ("/magnetometer", "z"): 1.2}
        self.sensor_state = {}
    
    def create_mapping(self, sensor_address, cc_number, transformation_name=None, transformation_params=None):
        """Create and register a new single-input mapping (backward compatible)."""
        mapping = Mapping(
            mapping_id=self.next_id,
            sensor_address=sensor_address,
            cc_number=cc_number,
            transformation_name=transformation_name,
            transformation_params=transformation_params
        )
        self.mappings[self.next_id] = mapping
        self.next_id += 1
        return mapping
    
    def create_multi_input_mapping(self, input_sources, cc_number, transformation_name, transformation_params=None):
        """
        Create a multi-input mapping.
        
        Args:
            input_sources: List of (address, metric_name) tuples
                          E.g., [("/touch1", "x"), ("/touch1", "y")]
            cc_number: MIDI CC output
            transformation_name: Name of transformation (e.g., "xy_to_cc")
            transformation_params: Dict of parameters for transformation
        
        Returns:
            The created Mapping object
        """
        mapping = Mapping(
            mapping_id=self.next_id,
            input_sources=input_sources,
            cc_number=cc_number,
            transformation_name=transformation_name,
            transformation_params=transformation_params or {}
        )
        self.mappings[self.next_id] = mapping
        self.next_id += 1
        return mapping
    
    def delete_mapping(self, mapping_id):
        """Remove a mapping."""
        if mapping_id in self.mappings:
            del self.mappings[mapping_id]
            return True
        return False
    
    def get_mapping(self, mapping_id):
        """Retrieve a mapping."""
        return self.mappings.get(mapping_id)
    
    def get_all_mappings(self):
        """Get all mappings."""
        return list(self.mappings.values())
    
    def get_mappings_for_sensor(self, sensor_address):
        """Get all single-input mappings for a specific sensor."""
        return [m for m in self.mappings.values() if m.sensor_address == sensor_address]
    
    def update_sensor_state(self, address, values_dict):
        """
        Update the cached state for a sensor.
        
        Args:
            address: Sensor address (e.g., "/touch1")
            values_dict: Dict of {metric_name: value} (e.g., {"x": 0.5, "y": 0.7})
        """
        for metric_name, value in values_dict.items():
            key = (address, metric_name)
            self.sensor_state[key] = value
    
    def apply_sensor_value(self, sensor_address, values_dict):
        """
        Apply sensor values to all relevant mappings.
        Handles both single-input and multi-input mappings.
        
        Args:
            sensor_address: Address like "/touch1"
            values_dict: Dict like {"x": 0.5, "y": 0.7, "id": 1}
        
        Returns:
            List of (cc_number, cc_value) tuples
        """
        results = []
        
        # Update sensor state cache
        self.update_sensor_state(sensor_address, values_dict)
        
        # Check all mappings
        for mapping in self.get_all_mappings():
            input_sources = mapping.get_required_inputs()
            
            if not input_sources:
                continue
            
            # Build input dict from sensor state
            input_dict = {}
            all_inputs_available = True
            
            for addr, metric in input_sources:
                key = (addr, metric)
                if key in self.sensor_state:
                    input_dict[key] = self.sensor_state[key]
                else:
                    all_inputs_available = False
                    break
            
            # Apply transformation if all inputs are available
            if all_inputs_available:
                cc_value = mapping.apply_transformation(input_dict)
                if cc_value is not None:
                    results.append((mapping.cc_number, cc_value))
        
        return results
    
    def export_mappings(self):
        """Export all mappings as list of dicts."""
        return [m.to_dict() for m in self.mappings.values()]
    
    def import_mappings(self, mapping_dicts):
        """Import mappings from list of dicts."""
        self.mappings.clear()
        self.next_id = 1
        
        for mapping_dict in mapping_dicts:
            self.create_mapping(
                sensor_address=mapping_dict["sensor_address"],
                cc_number=mapping_dict["cc_number"],
                transformation_name=mapping_dict.get("transformation_name"),
                transformation_params=mapping_dict.get("transformation_params", {})
            )


if __name__ == "__main__":
    # Quick test
    manager = MappingManager()
    
    # Create a mapping: accelerometer X → CC 10 using normalize_to_cc
    mapping = manager.create_mapping(
        sensor_address="/accelerometer/x",
        cc_number=10,
        transformation_name="normalize_to_cc",
        transformation_params={"min_val": 0, "max_val": 100}
    )
    
    print("Created mapping:", mapping.to_dict())
    
    # Apply a sensor value
    results = manager.apply_sensor_value("/accelerometer/x", 50)
    print("Sensor value 50 → CC results:", results)
