"""
Sensor data monitoring and state tracking for the launcher.
Maintains real-time sensor readings, history, and grouping.
"""

from collections import defaultdict
from datetime import datetime


class MonitorState:
    """Tracks monitoring state, sensor data, and history."""
    
    def __init__(self):
        self.enabled = False
        self.paused = False
        self.current_group = None
        self.selected_metric = None
        
        # Data storage: { group_name: { metric_name: [values...], ... }, ... }
        self.history = defaultdict(lambda: defaultdict(list))
        self.current_values = defaultdict(lambda: defaultdict(float))
        
        # Metadata
        self.last_update = {}
        self.metrics_info = {}  # { "group/metric": {"min": 0, "max": 100, ...} }
    
    def add_entry(self, address, values):
        """
        Add sensor entry to monitoring history.
        
        Args:
            address: e.g., "/accelerometer" or "/touch/x"
            values: dict of sensor data (e.g., {"x": 1.0, "y": 2.0} or {"value": 100})
        """
        if not self.enabled:
            return
        
        # Parse address to get group
        parts = address.strip('/').split('/')
        if not parts or not parts[0]:
            return
        
        group = parts[0]
        
        # If values is empty, nothing to store
        if not values:
            return
        
        # Store each key in values as a separate metric
        for metric_name, metric_value in values.items():
            # Skip non-numeric values
            if metric_value is None:
                continue
            
            try:
                numeric_value = float(metric_value)
            except (TypeError, ValueError):
                continue
            
            # Store current value
            self.current_values[group][metric_name] = numeric_value
            self.last_update[f"{group}/{metric_name}"] = datetime.now()
            
            # Store in history (limit to last 100 entries)
            self.history[group][metric_name].append(numeric_value)
            if len(self.history[group][metric_name]) > 100:
                self.history[group][metric_name].pop(0)
    
    def get_group_metrics(self, group_name):
        """Get list of metrics for a group."""
        return list(self.history[group_name].keys()) if group_name in self.history else []
    
    def get_group_data(self, group_name, metric_name):
        """Get history data for a specific metric."""
        return self.history[group_name].get(metric_name, [])
    
    def get_current_value(self, group_name, metric_name):
        """Get the latest value for a metric."""
        return self.current_values[group_name].get(metric_name, 0)
    
    def get_stats(self, group_name, metric_name):
        """Calculate min/max/avg for a metric."""
        data = self.get_group_data(group_name, metric_name)
        if not data:
            return {"min": 0, "max": 0, "avg": 0, "count": 0}
        
        return {
            "min": min(data),
            "max": max(data),
            "avg": sum(data) / len(data),
            "count": len(data),
            "current": data[-1] if data else 0
        }
    
    def clear_history(self):
        """Clear all historical data."""
        self.history.clear()
        self.current_values.clear()
        self.last_update.clear()
    
    def has_data(self, group_name=None):
        """Check if any data exists."""
        if group_name:
            return bool(self.history.get(group_name))
        return bool(self.history)


if __name__ == "__main__":
    # Quick test
    monitor = MonitorState()
    monitor.enabled = True
    
    # Simulate some entries
    monitor.add_entry("/accelerometer/x", {"value": 50})
    monitor.add_entry("/accelerometer/y", {"value": 75})
    monitor.add_entry("/accelerometer/z", {"value": 100})
    
    print("Groups:", list(monitor.history.keys()))
    print("Accelerometer metrics:", monitor.get_group_metrics("accelerometer"))
    print("Stats:", monitor.get_stats("accelerometer", "x"))
