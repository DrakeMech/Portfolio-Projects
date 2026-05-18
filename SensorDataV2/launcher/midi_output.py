"""
MIDI output management for sending CC messages to synths/controllers.
Uses python-rtmidi to send MIDI Control Change messages.
"""

try:
    import rtmidi
    RTMIDI_AVAILABLE = True
except ImportError:
    RTMIDI_AVAILABLE = False
    rtmidi = None


class MIDIOutput:
    """Handle MIDI CC output to hardware/software synths."""
    
    def __init__(self, port_name=None):
        """
        Initialize MIDI output.
        
        Args:
            port_name: Name of MIDI output port to use. 
                      If None, tries to find a suitable port or creates a virtual port.
        """
        if not RTMIDI_AVAILABLE:
            print("[WARNING] python-rtmidi not installed. MIDI output disabled.")
            self.midiout = None
            self.available_ports = []
            self.current_port_index = None
            return
        
        self.midiout = rtmidi.MidiOut()
        self.available_ports = self.get_available_ports()
        self.current_port_index = None
        
        if port_name:
            self.open_port_by_name(port_name)
        else:
            # Try to open first available port, or create virtual port
            if self.available_ports:
                self.open_port(0)
            else:
                print("[MIDI] Creating virtual MIDI output port 'SensorDataV2'")
                try:
                    self.midiout.open_virtual_port("SensorDataV2")
                except Exception as e:
                    print(f"[ERROR] Failed to create virtual MIDI port: {e}")
        
        if self.current_port_index is not None or (self.midiout and not self.available_ports):
            print(f"[MIDI] Output initialized")
    
    def get_available_ports(self):
        """Get list of available MIDI output ports."""
        if not self.midiout:
            return []
        
        ports = []
        for i in range(self.midiout.get_ports().__len__()):
            ports.append(self.midiout.get_ports()[i])
        return ports
    
    def open_port(self, port_index):
        """
        Open a MIDI port by index.
        
        Args:
            port_index: Index of port from get_available_ports()
        """
        if not self.midiout or port_index >= len(self.available_ports):
            return False
        
        try:
            self.midiout.open_port(port_index)
            self.current_port_index = port_index
            print(f"[MIDI] Opened port: {self.available_ports[port_index]}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to open MIDI port {port_index}: {e}")
            return False
    
    def open_port_by_name(self, port_name):
        """
        Open a MIDI port by name (partial match).
        
        Args:
            port_name: Name or partial name of port
        """
        if not self.midiout:
            return False
        
        for i, port in enumerate(self.available_ports):
            if port_name.lower() in port.lower():
                return self.open_port(i)
        
        print(f"[WARNING] MIDI port '{port_name}' not found. Available ports: {self.available_ports}")
        return False
    
    def send_cc(self, cc_number, cc_value, channel=1):
        """
        Send a MIDI Control Change message.
        
        Args:
            cc_number: CC number (0-127)
            cc_value: CC value (0-127)
            channel: MIDI channel (1-16, default 1)
        """
        if not self.midiout:
            return False
        
        # Validate inputs
        cc_number = max(0, min(127, int(cc_number)))
        cc_value = max(0, min(127, int(cc_value)))
        channel = max(1, min(16, int(channel)))
        
        try:
            # MIDI CC message: [0xB0 + (channel-1), cc_number, cc_value]
            msg = [0xB0 + (channel - 1), cc_number, cc_value]
            self.midiout.send_message(msg)
            return True
        except Exception as e:
            print(f"[ERROR] Failed to send MIDI CC: {e}")
            return False
    
    def send_note_on(self, note, velocity=100, channel=1):
        """
        Send a MIDI Note On message.
        
        Args:
            note: MIDI note number (0-127)
            velocity: Note velocity (0-127)
            channel: MIDI channel (1-16)
        """
        if not self.midiout:
            return False
        
        note = max(0, min(127, int(note)))
        velocity = max(0, min(127, int(velocity)))
        channel = max(1, min(16, int(channel)))
        
        try:
            msg = [0x90 + (channel - 1), note, velocity]
            self.midiout.send_message(msg)
            return True
        except Exception as e:
            print(f"[ERROR] Failed to send Note On: {e}")
            return False
    
    def send_note_off(self, note, channel=1):
        """
        Send a MIDI Note Off message.
        
        Args:
            note: MIDI note number (0-127)
            channel: MIDI channel (1-16)
        """
        if not self.midiout:
            return False
        
        note = max(0, min(127, int(note)))
        channel = max(1, min(16, int(channel)))
        
        try:
            msg = [0x80 + (channel - 1), note, 0]
            self.midiout.send_message(msg)
            return True
        except Exception as e:
            print(f"[ERROR] Failed to send Note Off: {e}")
            return False
    
    def close(self):
        """Close the MIDI output port."""
        if self.midiout:
            try:
                del self.midiout
                print("[MIDI] Output closed")
            except:
                pass


# Global MIDI output instance
midi_output = None


def initialize_midi(port_name=None):
    """Initialize the global MIDI output."""
    global midi_output
    midi_output = MIDIOutput(port_name)
    return midi_output


def send_cc(cc_number, cc_value, channel=1):
    """Send a CC message using the global MIDI output."""
    global midi_output
    if midi_output:
        return midi_output.send_cc(cc_number, cc_value, channel)
    return False


def get_midi_output():
    """Get the global MIDI output instance."""
    global midi_output
    return midi_output


if __name__ == "__main__":
    # Quick test
    midi = MIDIOutput()
    print(f"Available ports: {midi.available_ports}")
    
    # Send test CC
    if midi.midiout:
        print("Sending test CC messages...")
        for cc_num in range(0, 128, 16):
            midi.send_cc(cc_num, 64)
        midi.close()
