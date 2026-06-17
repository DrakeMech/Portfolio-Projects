"""
SensorDataV2 Launcher - Main control and monitoring application.
Desktop interface for managing sensor readings, mappings, and MIDI output.
"""

import os
import sys
import subprocess
import threading
import asyncio
import json
from datetime import datetime
import customtkinter as ctk
from tkinter import messagebox
import webbrowser

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from launcher.monitor import MonitorState
from launcher.mapping import MappingManager
from launcher.websocket_handler import WebSocketHandler
from launcher.graph import SensorGraph
from launcher.midi_output import initialize_midi, send_cc

# ============================================================================
# CONFIGURATION
# ============================================================================

# Get parent directory (SensorDataV2) where sensorData.py lives
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON = sys.executable
SENSOR_SCRIPT = os.path.join(SCRIPT_DIR, 'sensorData.py')
HTTP_PORT = 8080
WS_PORT = 8765
OSC_PORT = 9000

# ============================================================================
# GLOBALS
# ============================================================================

process_sensor = None
process_http = None
monitor_state = MonitorState()
mapping_manager = MappingManager()
ws_handler = None
sensor_graph = None  # Will be initialized in setup_ui()


# ============================================================================
# PROCESS MANAGEMENT
# ============================================================================

def run_sensor_server():
    """Start sensor and HTTP servers."""
    global process_sensor, process_http
    
    if process_sensor and process_sensor.poll() is None:
        update_status('Already running', 'yellow')
        return
    
    try:
        # Enable monitoring
        monitor_state.enabled = True
        print("[DEBUG] Monitoring ENABLED")
        
        cwd = SCRIPT_DIR
        process_sensor = subprocess.Popen(
            [PYTHON, 'sensorData.py'], 
            cwd=cwd,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        print("[DEBUG] sensorData.py process started")
        
        # Give sensor server a moment to start, then start HTTP server
        threading.Timer(1.0, lambda: _start_http_server(cwd)).start()
        
        update_status('Starting...', 'yellow')
        threading.Timer(3.0, check_process_status).start()
    except Exception as e:
        update_status(f'Failed: {e}', 'red')


def _start_http_server(cwd):
    """Start HTTP server in background."""
    global process_http
    try:
        process_http = subprocess.Popen(
            [PYTHON, '-m', 'http.server', str(HTTP_PORT)],
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception as e:
        print(f"Failed to start HTTP server: {e}")


def stop_sensor_server():
    """Stop sensor and HTTP servers."""
    global process_sensor, process_http
    
    # Disable monitoring
    monitor_state.enabled = False
    
    if process_sensor and process_sensor.poll() is None:
        process_sensor.terminate()
        try:
            process_sensor.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process_sensor.kill()
    
    if process_http and process_http.poll() is None:
        process_http.terminate()
        try:
            process_http.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process_http.kill()
    
    update_status('Stopped', 'gray')


def check_process_status():
    """Check if processes are still running."""
    global process_sensor, process_http
    
    if process_sensor is None or process_sensor.poll() is not None:
        update_status('Stopped', 'gray')
    elif process_http is None or process_http.poll() is not None:
        update_status('Running (HTTP error)', 'orange')
    else:
        update_status('Running', 'green')


def check_process_loop():
    """Continuous process status check."""
    while True:
        check_process_status()
        threading.Event().wait(2)


# ============================================================================
# MONITORING & TRANSFORMATION
# ============================================================================

def on_sensor_data(address, values):
    """Callback when sensor data arrives via WebSocket."""
    # print(f"[RECEIVED] address={address}, values={values}, keys={list(values.keys()) if values else 'empty'}") 

    """FOR DEBUGGING: Show all incoming data in the monitor text box"""
    
    monitor_state.add_entry(address, values)
    
    # Extract sensor group from address (e.g., "/touch1" -> "touch1")
    sensor_group = address.strip('/').split('/')[0] if address else None
    
    # Record data points in the graph if recording is active
    if sensor_graph and sensor_graph.recording and sensor_group:
        for metric_name, metric_value in values.items():
            if isinstance(metric_value, (int, float)):
                sensor_graph.record_point(sensor_group, metric_name, metric_value)
    
    # Debug: show what was stored
    # group = address.strip('/').split('/')[0]
    # if monitor_state.history.get(group):
    #     print(f"[STORED] {group}: {dict(monitor_state.history[group])}")
    
    # Apply transformations - pass all values to mapping manager
    cc_results = mapping_manager.apply_sensor_value(address, values)
    
    if cc_results:
        for cc_num, cc_val in cc_results:
            print(f"  → CC {cc_num}: {cc_val}")
            # Send MIDI CC message
            send_cc(cc_num, cc_val)


async def start_websocket_listener():
    """Start listening for WebSocket sensor data."""
    global ws_handler
    
    # Give sensor server time to start (~3 seconds)
    print("Waiting for sensor server to start...")
    await asyncio.sleep(3)
    
    print("[DEBUG] Creating WebSocket handler...")
    ws_handler = WebSocketHandler(
        uri=f"ws://localhost:{WS_PORT}",
        on_data_callback=on_sensor_data
    )
    
    print("[DEBUG] Starting WebSocket listener...")
    await ws_handler.listen()


def run_websocket_loop():
    """Run WebSocket listener in a separate thread."""
    try:
        asyncio.run(start_websocket_listener())
    except Exception as e:
        print(f"WebSocket error: {e}")


# ============================================================================
# UI CALLBACKS
# ============================================================================

def open_web_ui():
    """Open the transformation editor website."""
    url = f'http://localhost:{HTTP_PORT}/web/index.html'
    try:
        webbrowser.open(url)
    except Exception as e:
        messagebox.showerror('Error', f'Failed to open browser: {e}')


def show_connection_info():
    """Show connection details."""
    info = f"""
Connection Details:

Sensor Server: localhost:{WS_PORT}
HTTP Server: http://localhost:{HTTP_PORT}
OSC (if using): localhost:{OSC_PORT}

Web UI: http://localhost:{HTTP_PORT}/index.html
"""
    messagebox.showinfo('Connection Info', info)


def update_status(text, color):
    """Update status label."""
    if 'status_label' in globals() and status_label:
        status_label.configure(text=text, text_color=color)


def create_mapping_dialog():
    """Open dialog to create new sensor → MIDI mapping (single or multi-input)."""
    dialog = ctk.CTkToplevel(root)
    dialog.title("Create Mapping")
    dialog.geometry("500x600")
    
    # Mode selector
    ctk.CTkLabel(dialog, text="Mapping Mode:", font=('Segoe UI', 10, 'bold')).pack(pady=(10, 0), padx=10, anchor="w")
    mode_var = ctk.StringVar(value="single")
    ctk.CTkRadioButton(dialog, text="Single Input (one sensor parameter)", variable=mode_var, value="single").pack(pady=5, padx=10, anchor="w")
    ctk.CTkRadioButton(dialog, text="Multi Input (combine multiple sensors)", variable=mode_var, value="multi").pack(pady=5, padx=10, anchor="w")
    
    # ---- SINGLE INPUT MODE ----
    single_frame = ctk.CTkFrame(dialog, fg_color="transparent")
    single_frame.pack(padx=10, pady=10, fill="x")
    
    ctk.CTkLabel(single_frame, text="Sensor Address:", text_color="#aaa").pack(pady=(5, 0), anchor="w")
    sensor_entry = ctk.CTkEntry(single_frame, placeholder_text="/touch1/x or /touch1")
    sensor_entry.pack(pady=5, fill="x")
    
    # ---- MULTI INPUT MODE ----
    multi_frame = ctk.CTkFrame(dialog, fg_color="#2a2a2a", border_width=1, border_color="#00ffff")
    multi_frame.pack(padx=10, pady=10, fill="both", expand=True)
    
    ctk.CTkLabel(multi_frame, text="Select Input Sources:", text_color="#0ff", font=('Segoe UI', 10, 'bold')).pack(pady=5, padx=5, anchor="w")
    
    # Available sensors that have sent data
    input_sources_listbox = ctk.CTkTextbox(multi_frame, height=150, width=400)
    input_sources_listbox.pack(pady=5, padx=5, fill="both", expand=True)
    
    # Instructions
    ctk.CTkLabel(multi_frame, text="Format: /touch1/x, /touch1/y (comma-separated)\nor /magnetometer/z,/accelerometer/x", 
                 text_color="#888", font=('Segoe UI', 8)).pack(pady=5, padx=5, anchor="w")
    
    # CC Number (same for both modes)
    ctk.CTkLabel(dialog, text="MIDI CC Number (0-127):", text_color="#aaa").pack(pady=(10, 0), padx=10, anchor="w")
    cc_entry = ctk.CTkEntry(dialog, placeholder_text="10")
    cc_entry.pack(pady=5, padx=10, fill="x")
    
    # Transformation selector
    ctk.CTkLabel(dialog, text="Transformation:", font=('Segoe UI', 10, 'bold')).pack(pady=(10, 0), padx=10, anchor="w")
    
    # Get available transformations
    available_transforms = ["passthrough", "normalize_to_cc", "invert", "exponential_curve"]
    # Add multi-input transformations
    available_transforms.extend(["xy_to_cc", "amplified_by_sensor", "combined_motion", "sensor_blend", "velocity_from_motion"])
    available_transforms.append("custom")
    
    transform_combo = ctk.CTkComboBox(dialog, values=available_transforms)
    transform_combo.set("passthrough")
    transform_combo.pack(pady=5, padx=10, fill="x")
    
    # Help text for transformation
    help_text = ctk.CTkLabel(
        dialog,
        text="Multi-input: xy_to_cc (x+y), amplified_by_sensor (amp*primary), combined_motion (x+y+z), sensor_blend (mix 2 values), velocity_from_motion (motion speed)",
        text_color="#888",
        font=('Segoe UI', 8),
        wraplength=450
    )
    help_text.pack(pady=5, padx=10, anchor="w")
    
    # Transformation parameters
    ctk.CTkLabel(dialog, text="Parameters (optional, JSON):", text_color="#aaa", font=('Segoe UI', 9)).pack(pady=(5, 0), padx=10, anchor="w")
    params_entry = ctk.CTkEntry(dialog, placeholder_text='{"mode": "magnitude"} or {"amplifier_factor": 1.5}')
    params_entry.pack(pady=5, padx=10, fill="x")
    
    def save_mapping():
        try:
            import json
            
            mode = mode_var.get()
            cc = int(cc_entry.get())
            transform = transform_combo.get()
            params_str = params_entry.get()
            
            # Parse parameters
            params = {}
            if params_str:
                try:
                    params = json.loads(params_str)
                except:
                    messagebox.showerror("Error", "Parameters must be valid JSON")
                    return
            
            if cc < 0 or cc > 127:
                messagebox.showerror("Error", "CC must be 0-127")
                return
            
            if mode == "single":
                sensor = sensor_entry.get()
                if not sensor:
                    messagebox.showerror("Error", "Please enter sensor address")
                    return
                
                mapping = mapping_manager.create_mapping(sensor, cc, transform, params)
                messagebox.showinfo("Success", f"Single-input mapping created:\n{sensor} → CC {cc}")
            
            else:  # multi
                inputs_text = input_sources_listbox.get("0.0", "end").strip()
                if not inputs_text:
                    messagebox.showerror("Error", "Please specify input sources")
                    return
                
                # Parse input sources: "address1/metric1, address2/metric2"
                input_sources = []
                for item in inputs_text.split(','):
                    item = item.strip()
                    if '/' in item:
                        parts = item.split('/')
                        # Handle "/touch1/x" → ("/touch1", "x")
                        if len(parts) == 3:
                            addr = f"/{parts[1]}"
                            metric = parts[2]
                        elif len(parts) == 2:
                            addr = f"/{parts[0]}"
                            metric = parts[1]
                        else:
                            continue
                        input_sources.append((addr, metric))
                
                if not input_sources:
                    messagebox.showerror("Error", "No valid input sources found")
                    return
                
                mapping = mapping_manager.create_multi_input_mapping(input_sources, cc, transform, params)
                sources_str = ", ".join([f"{a}/{m}" for a, m in input_sources])
                messagebox.showinfo("Success", f"Multi-input mapping created:\n[{sources_str}] → CC {cc}\nTransform: {transform}")
            
            dialog.destroy()
        except ValueError as e:
            messagebox.showerror("Error", f"Invalid input: {e}")
    
    ctk.CTkButton(dialog, text="Create Mapping", command=save_mapping, height=40).pack(pady=10, padx=10, fill="x")


# ============================================================================
# MAIN WINDOW
# ============================================================================

def setup_ui():
    """Setup the main CustomTkinter UI."""
    global root, status_label
    
    # Initialize MIDI output
    print("[INIT] Initializing MIDI output...")
    initialize_midi()
    
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    
    root = ctk.CTk()
    root.title('SensorDataV2 Launcher')
    root.geometry('800x1000')
    
    # ---- Scrollable Main Frame ----
    main_frame = ctk.CTkScrollableFrame(root, fg_color="#1a1a1a", border_width=2, border_color="#00ffff")
    main_frame.pack(expand=True, fill='both', padx=10, pady=10)
    
    # ---- Status ----
    ctk.CTkLabel(main_frame, text="Status", font=('Segoe UI', 12, 'bold')).pack(pady=(10, 5), anchor="w", padx=10)
    status_label = ctk.CTkLabel(main_frame, text='Stopped', text_color='gray', font=('Segoe UI', 14, 'bold'))
    status_label.pack(pady=5)
    
    # ---- Server Controls ----
    ctk.CTkLabel(main_frame, text="Server", font=('Segoe UI', 12, 'bold')).pack(pady=(15, 5), anchor="w", padx=10)
    
    button_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
    button_frame.pack(padx=10, pady=5, fill="x")
    
    ctk.CTkButton(
        button_frame, text='Start', width=100, fg_color="#333333",
        hover_color="#555555", border_width=1, border_color="#00ffff",
        command=run_sensor_server
    ).pack(side="left", padx=5)
    
    ctk.CTkButton(
        button_frame, text='Stop', width=100, fg_color="#333333",
        hover_color="#555555", border_width=1, border_color="#00ffff",
        command=stop_sensor_server
    ).pack(side="left", padx=5)
    
    ctk.CTkButton(
        button_frame, text='Info', width=100, fg_color="#333333",
        hover_color="#555555", border_width=1, border_color="#00ffff",
        command=show_connection_info
    ).pack(side="left", padx=5)
    
    # ---- Web UI ----
    ctk.CTkLabel(main_frame, text="Development", font=('Segoe UI', 12, 'bold')).pack(pady=(15, 5), anchor="w", padx=10)
    
    ctk.CTkButton(
        main_frame, text='Open Transformation Editor', width=200, height=35,
        fg_color="#333333", hover_color="#555555",
        border_width=1, border_color="#00ffff",
        command=open_web_ui
    ).pack(pady=5, padx=10, fill="x")
    
    # ---- Monitoring ----
    ctk.CTkLabel(main_frame, text="Sensor Monitoring", font=('Segoe UI', 12, 'bold')).pack(pady=(15, 5), anchor="w", padx=10)
    
    # Sensor group selector
    selector_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
    selector_frame.pack(padx=10, pady=5, fill="x")
    
    ctk.CTkLabel(selector_frame, text="Sensor:", text_color="#aaa").pack(side="left", padx=(0, 5))
    sensor_combo = ctk.CTkComboBox(
        selector_frame,
        values=["All"],
        state="readonly",
        width=150
    )
    sensor_combo.set("All")
    sensor_combo.pack(side="left", padx=5)
    
    # Debug info
    debug_label = ctk.CTkLabel(
        main_frame, 
        text=f"Monitoring Enabled: {monitor_state.enabled} | WS Connected: {ws_handler.connected if ws_handler else False}", 
        font=('Segoe UI', 9), 
        text_color='#888'
    )
    debug_label.pack(pady=(0, 5), anchor="w", padx=10)
    
    monitor_text = ctk.CTkTextbox(main_frame, height=100, width=400)
    monitor_text.pack(pady=5, padx=10, fill="both")
    
    def update_monitor_display():
        # Update debug info
        ws_status = ws_handler.connected if ws_handler else False
        debug_label.configure(
            text=f"Monitoring Enabled: {monitor_state.enabled} | WS Connected: {ws_status} | Groups: {len(monitor_state.history)}"
        )
        
        # Update sensor group dropdown
        available_groups = sorted(monitor_state.history.keys())
        current_values = ["All"] + available_groups
        sensor_combo.configure(values=current_values)
        
        # Get selected sensor group
        selected_sensor = sensor_combo.get()
        if selected_sensor not in current_values:
            selected_sensor = "All"
            sensor_combo.set("All")
        
        monitor_text.configure(state="normal")
        monitor_text.delete("0.0", "end")
        
        if monitor_state.has_data():
            # Determine which groups to display
            if selected_sensor == "All":
                groups_to_display = sorted(monitor_state.history.keys())
            else:
                groups_to_display = [selected_sensor]
            
            for group_name in groups_to_display:
                group_metrics = monitor_state.get_group_metrics(group_name)
                if group_metrics:
                    monitor_text.insert("end", f"📡 {group_name}:\n")
                    for metric in sorted(group_metrics):
                        stats = monitor_state.get_stats(group_name, metric)
                        current = stats['current']
                        min_val = stats['min']
                        max_val = stats['max']
                        avg_val = stats['avg']
                        count = stats['count']
                        
                        line = f"  {metric}: {current:.1f} | Min: {min_val:.1f} Max: {max_val:.1f} Avg: {avg_val:.1f} (n={count})\n"
                        monitor_text.insert("end", line)
                    monitor_text.insert("end", "\n")
        else:
            monitor_text.insert("end", "Waiting for sensor data...\n")
            monitor_text.insert("end", f"\nDEBUG: monitor.enabled={monitor_state.enabled}")
            monitor_text.insert("end", f"\nDEBUG: history={dict(monitor_state.history)}")
            if ws_handler:
                monitor_text.insert("end", f"\nDEBUG: ws.connected={ws_handler.connected}")
        
        monitor_text.configure(state="disabled")
        # Refresh every 1 second for real-time updates
        root.after(1000, update_monitor_display)
    
    update_monitor_display()
    
    # ---- Graph Display ----
    ctk.CTkLabel(main_frame, text="Live Graph", font=('Segoe UI', 12, 'bold')).pack(pady=(15, 5), anchor="w", padx=10)
    
    graph_selector_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
    graph_selector_frame.pack(padx=10, pady=5, fill="x")
    
    ctk.CTkLabel(graph_selector_frame, text="Graph Sensor:", text_color="#aaa").pack(side="left", padx=(0, 5))
    graph_sensor_combo = ctk.CTkComboBox(
        graph_selector_frame,
        values=["touch1"],
        state="readonly",
        width=150
    )
    graph_sensor_combo.set("touch1")
    graph_sensor_combo.pack(side="left", padx=5)
    
    global sensor_graph
    sensor_graph = SensorGraph(main_frame, monitor_state)
    sensor_graph.pack(padx=10, pady=5, fill="both")
    
    def update_graph_display():
        if sensor_graph:
            # Update available sensors in dropdown
            available_graphs = sorted(monitor_state.history.keys())
            if available_graphs:
                graph_sensor_combo.configure(values=available_graphs)
                if graph_sensor_combo.get() not in available_graphs:
                    graph_sensor_combo.set(available_graphs[0])
            
            # Update graph with selected sensor
            selected_sensor = graph_sensor_combo.get()
            sensor_graph.update_graph(selected_sensor)
        # Refresh every 500ms for smooth updates
        root.after(500, update_graph_display)
    
    update_graph_display()
    
    # ---- Mappings ----
    ctk.CTkLabel(main_frame, text="Mappings", font=('Segoe UI', 12, 'bold')).pack(pady=(15, 5), anchor="w", padx=10)
    
    ctk.CTkButton(
        main_frame, text='Create Mapping', width=200, height=35,
        fg_color="#333333", hover_color="#555555",
        border_width=1, border_color="#00ffff",
        command=create_mapping_dialog
    ).pack(pady=5, padx=10, fill="x")
    
    mappings_text = ctk.CTkTextbox(main_frame, height=100, width=400)
    mappings_text.pack(pady=5, padx=10, fill="both", expand=True)
    
    def update_mappings_display():
        mappings_text.configure(state="normal")
        mappings_text.delete("0.0", "end")
        
        if mapping_manager.mappings:
            for mapping in mapping_manager.get_all_mappings():
                stats = mapping.get_cc_stats()
                line = f"{mapping.sensor_address} → CC{mapping.cc_number}\n"
                line += f"  Transform: {mapping.transformation_name}\n"
                line += f"  Current: {stats['current']} | Min: {stats['min']} Max: {stats['max']} Avg: {stats['avg']:.1f}\n"
                line += f"  Updates: {stats['updates']} | Duration: {stats['duration_seconds']}s | Rate: {stats['rate_of_change']:.2f} CC/s\n"
                line += "\n"
                mappings_text.insert("end", line)
        else:
            mappings_text.insert("end", "No mappings created yet.")
        
        mappings_text.configure(state="disabled")
        # Refresh every 2 seconds
        root.after(2000, update_mappings_display)
    
    update_mappings_display()
    
    # ---- Cleanup ----
    def on_close():
        stop_sensor_server()
        root.destroy()
    
    root.protocol('WM_DELETE_WINDOW', on_close)
    root.mainloop()


# ============================================================================
# STARTUP
# ============================================================================

if __name__ == "__main__":
    print("Starting SensorDataV2 Launcher...")
    
    # Start process check thread
    check_thread = threading.Thread(target=check_process_loop, daemon=True)
    check_thread.start()
    
    # Start WebSocket listener thread
    ws_thread = threading.Thread(target=run_websocket_loop, daemon=True)
    ws_thread.start()
    
    # Setup and run UI
    setup_ui()
