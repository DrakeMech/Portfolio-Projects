"""
Real-time graph display for sensor monitoring.
Integrates matplotlib with CustomTkinter for live data visualization.
"""

import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import customtkinter as ctk


class SensorGraph:
    """Real-time graph for monitoring sensor data."""
    
    def __init__(self, parent, monitor_state):
        """
        Args:
            parent: parent CTk widget
            monitor_state: MonitorState instance to monitor
        """
        self.monitor_state = monitor_state
        self.recording = False
        self.selected_sensor = None
        self.recorded_data = {}  # {sensor_group: {metric_name: [values]}}
        
        # Create figure for matplotlib
        self.figure = Figure(figsize=(7, 3), dpi=80, facecolor='#0a0a0a', edgecolor='#00ffff')
        self.figure.patch.set_facecolor('#0a0a0a')
        self.ax = self.figure.add_subplot(111)
        self.ax.set_facecolor('#1a1a1a')
        
        # Create tkinter canvas for matplotlib
        self.canvas = FigureCanvasTkAgg(self.figure, master=parent)
        self.canvas.get_tk_widget().configure(bg='#0a0a0a', highlightthickness=0)
        
        # Control frame
        self.controls_frame = ctk.CTkFrame(parent, fg_color="transparent")
        
        # Start/Stop recording button
        self.record_btn = ctk.CTkButton(
            self.controls_frame,
            text="⏺️ Start Recording",
            width=120,
            fg_color="#333333",
            hover_color="#555555",
            border_width=1,
            border_color="#00ffff",
            command=self.toggle_recording
        )
        self.record_btn.pack(side="left", padx=5)
        
        # Clear button
        self.clear_btn = ctk.CTkButton(
            self.controls_frame,
            text="🗑️ Clear",
            width=80,
            fg_color="#333333",
            hover_color="#555555",
            border_width=1,
            border_color="#ff6666",
            command=self.clear_data
        )
        self.clear_btn.pack(side="left", padx=5)
        
        # Metric selector
        ctk.CTkLabel(self.controls_frame, text="Metrics:", text_color="#aaa").pack(side="left", padx=(15, 5))
        self.metric_combo = ctk.CTkComboBox(
            self.controls_frame,
            values=["x, y", "x only", "y only"],
            state="readonly",
            width=100
        )
        self.metric_combo.set("x, y")
        self.metric_combo.pack(side="left", padx=5)
    
    def toggle_recording(self):
        """Toggle data recording on/off."""
        self.recording = not self.recording
        if self.recording:
            self.recorded_data = {}
            self.record_btn.configure(text="⏹️ Stop Recording", fg_color="#cc3333")
        else:
            self.record_btn.configure(text="⏺️ Start Recording", fg_color="#333333")
    
    def clear_data(self):
        """Clear recorded data."""
        self.recorded_data = {}
        self.ax.clear()
        self.canvas.draw()
    
    def record_point(self, sensor_group, metric_name, value):
        """Record a single data point if recording is active."""
        if self.recording:
            if sensor_group not in self.recorded_data:
                self.recorded_data[sensor_group] = {}
            if metric_name not in self.recorded_data[sensor_group]:
                self.recorded_data[sensor_group][metric_name] = []
            self.recorded_data[sensor_group][metric_name].append(value)
    
    def update_graph(self, selected_sensor=None):
        """Update the graph with recorded data from the selected sensor."""
        # Use stored sensor selection if not provided
        if selected_sensor is None:
            selected_sensor = self.selected_sensor
        else:
            self.selected_sensor = selected_sensor
        
        self.ax.clear()
        
        # Don't draw if no data or no sensor selected
        if not self.recorded_data or not selected_sensor:
            self.canvas.draw()
            return
        
        # Get data for selected sensor
        sensor_data = self.recorded_data.get(selected_sensor, {})
        if not sensor_data:
            self.canvas.draw()
            return
        
        metrics = self.metric_combo.get()
        
        # Plot based on selected metrics
        if "x" in metrics and "x" in sensor_data:
            x_data = sensor_data["x"]
            self.ax.plot(x_data, label="X", color="#00ff00", linewidth=1.5, alpha=0.8)
        
        if "y" in metrics and "y" in sensor_data:
            y_data = sensor_data["y"]
            self.ax.plot(y_data, label="Y", color="#ff00ff", linewidth=1.5, alpha=0.8)
        
        # Styling
        self.ax.set_facecolor('#1a1a1a')
        self.ax.grid(True, alpha=0.2, color='#00ffff')
        self.ax.legend(loc='upper right', framealpha=0.9)
        self.ax.set_xlabel('Sample', color='#aaa', fontsize=9)
        self.ax.set_ylabel('Value', color='#aaa', fontsize=9)
        self.ax.tick_params(colors='#aaa', labelsize=8)
        
        # Set color for spines
        for spine in self.ax.spines.values():
            spine.set_color('#00aaff')
        
        self.canvas.draw()
    
    def pack(self, **kwargs):
        """Pack the graph and controls."""
        self.controls_frame.pack(**kwargs)
        self.canvas.get_tk_widget().pack(**kwargs)
