import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import serial
import serial.tools.list_ports
import json
import os
from datetime import datetime
from threading import Thread, Lock
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import time

class FSRDataRecorder:
    def __init__(self, root):
        self.root = root
        self.root.title("FSR Data Recorder")
        self.root.geometry("1000x700")
        
        # Data storage
        self.data = []
        self.is_recording = False
        self.serial_conn = None
        self.start_time = None
        self.data_lock = Lock()
        
        # Session info
        self.current_session = "Freeform"
        self.sessions = ["Freeform", "Elastic Surface", "Plastic Surface"]
        self.session_start_time = None
        
        self.setup_ui()
        self.setup_serial_ports()
        
    def setup_ui(self):
        # Top control panel
        control_frame = ttk.Frame(self.root)
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=10)
        
        # Port selection
        ttk.Label(control_frame, text="COM Port:").pack(side=tk.LEFT, padx=5)
        self.port_var = tk.StringVar()
        self.port_combo = ttk.Combobox(control_frame, textvariable=self.port_var, width=15, state="readonly")
        self.port_combo.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(control_frame, text="Refresh Ports", command=self.setup_serial_ports).pack(side=tk.LEFT, padx=5)
        
        # Baud rate
        ttk.Label(control_frame, text="Baud Rate:").pack(side=tk.LEFT, padx=5)
        self.baud_var = tk.StringVar(value="9600")
        baud_combo = ttk.Combobox(control_frame, textvariable=self.baud_var, 
                                   values=["9600", "115200", "57600"], width=10, state="readonly")
        baud_combo.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(control_frame, text="Connect", command=self.connect_serial).pack(side=tk.LEFT, padx=5)
        
        self.status_label = ttk.Label(control_frame, text="Disconnected", foreground="red")
        self.status_label.pack(side=tk.LEFT, padx=20)
        
        # Session selection and recording controls
        session_frame = ttk.LabelFrame(self.root, text="Session Management", padding=10)
        session_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(session_frame, text="Material Type:").pack(side=tk.LEFT, padx=5)
        self.session_var = tk.StringVar(value=self.current_session)
        session_combo = ttk.Combobox(session_frame, textvariable=self.session_var, 
                                     values=self.sessions, state="readonly", width=20)
        session_combo.pack(side=tk.LEFT, padx=5)
        
        self.record_btn = ttk.Button(session_frame, text="Start Recording", command=self.start_recording, state=tk.DISABLED)
        self.record_btn.pack(side=tk.LEFT, padx=5)
        
        self.stop_btn = ttk.Button(session_frame, text="Stop Recording", command=self.stop_recording, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT, padx=5)
        
        self.clear_btn = ttk.Button(session_frame, text="Clear Data", command=self.clear_data)
        self.clear_btn.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(session_frame, text="Save as JSON", command=self.save_json, state=tk.NORMAL).pack(side=tk.LEFT, padx=5)
        
        # Data display
        display_frame = ttk.LabelFrame(self.root, text="Real-time Data", padding=10)
        display_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Create matplotlib figure
        self.fig = Figure(figsize=(9, 4), dpi=100)
        self.ax = self.fig.add_subplot(111)
        self.canvas = FigureCanvasTkAgg(self.fig, master=display_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Data info panel
        info_frame = ttk.LabelFrame(self.root, text="Data Info", padding=10)
        info_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.info_text = tk.Text(info_frame, height=4, width=50)
        self.info_text.pack(fill=tk.BOTH, expand=True)
        
    def setup_serial_ports(self):
        ports = [port.device for port in serial.tools.list_ports.comports()]
        self.port_combo['values'] = ports
        if ports:
            self.port_combo.current(0)
    
    def connect_serial(self):
        try:
            if self.serial_conn:
                self.serial_conn.close()
            
            port = self.port_var.get()
            baud = int(self.baud_var.get())
            
            if not port:
                messagebox.showerror("Error", "Please select a COM port")
                return
            
            self.serial_conn = serial.Serial(port, baud, timeout=1)
            self.status_label.config(text=f"Connected to {port} @ {baud} baud", foreground="green")
            self.record_btn.config(state=tk.NORMAL)
            
            # Start reading thread
            Thread(target=self.read_serial, daemon=True).start()
            
        except Exception as e:
            messagebox.showerror("Connection Error", str(e))
            self.status_label.config(text="Connection Failed", foreground="red")
    
    def read_serial(self):
        while self.serial_conn and self.serial_conn.is_open:
            try:
                if self.serial_conn.in_waiting:
                    line = self.serial_conn.readline().decode('utf-8').strip()
                    if line and self.is_recording:
                        try:
                            raw_value = int(line)
                            current_time = time.time() - self.start_time
                            
                            with self.data_lock:
                                self.data.append({
                                    "time": round(current_time * 1000, 2),  # milliseconds
                                    "force": raw_value
                                })
                            
                            self.update_display()
                        except ValueError:
                            pass
            except:
                break
    
    def start_recording(self):
        if not self.serial_conn or not self.serial_conn.is_open:
            messagebox.showerror("Error", "Not connected to serial port")
            return
        
        self.current_session = self.session_var.get()
        self.clear_data()
        self.is_recording = True
        self.start_time = time.time()
        self.session_start_time = datetime.now()
        
        self.record_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.status_label.config(text=f"Recording: {self.current_session}", foreground="blue")
    
    def stop_recording(self):
        self.is_recording = False
        self.record_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.status_label.config(text="Recording Stopped", foreground="orange")
    
    def clear_data(self):
        with self.data_lock:
            self.data = []
        self.update_display()
    
    def update_display(self):
        with self.data_lock:
            if not self.data:
                return
            
            times = [d["time"] for d in self.data]
            forces = [d["force"] for d in self.data]
        
        self.ax.clear()
        self.ax.plot(times, forces, 'b-', linewidth=2, label="FSR Reading")
        self.ax.set_xlabel("Time (ms)")
        self.ax.set_ylabel("Force Value (0-4095)")
        self.ax.set_title(f"FSR Data - {self.current_session}")
        self.ax.grid(True, alpha=0.3)
        self.ax.legend()
        self.fig.tight_layout()
        self.canvas.draw()
        
        # Update info
        self.root.after(0, self._update_info)
    
    def _update_info(self):
        with self.data_lock:
            if self.data:
                forces = [d["force"] for d in self.data]
                self.info_text.config(state=tk.NORMAL)
                self.info_text.delete(1.0, tk.END)
                self.info_text.insert(tk.END, 
                    f"Data Points: {len(self.data)}\n"
                    f"Duration: {self.data[-1]['time']:.2f} ms\n"
                    f"Min Force: {min(forces)}\n"
                    f"Max Force: {max(forces)}\n"
                    f"Avg Force: {sum(forces)/len(forces):.1f}\n"
                    f"Session: {self.current_session}"
                )
                self.info_text.config(state=tk.DISABLED)
    
    def save_json(self):
        with self.data_lock:
            if not self.data:
                messagebox.showwarning("Warning", "No data to save")
                return
            
            data_to_save = self.data.copy()
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        material_name = self.current_session.replace(" ", "_")
        filename = f"{material_name}_{timestamp}.json"
        
        try:
            # Save to same directory as script
            filepath = os.path.join(os.path.dirname(__file__), filename)
            
            with open(filepath, 'w') as f:
                json.dump(data_to_save, f, indent=2)
            
            messagebox.showinfo("Success", f"Data saved to:\n{filepath}")
            
        except Exception as e:
            messagebox.showerror("Save Error", str(e))

if __name__ == "__main__":
    root = tk.Tk()
    app = FSRDataRecorder(root)
    root.mainloop()
