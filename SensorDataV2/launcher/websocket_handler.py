"""
WebSocket handler for receiving sensor data in the launcher.
Connects to sensorData.py server and processes incoming readings.
"""

import asyncio
import websockets
import json
from datetime import datetime


class WebSocketHandler:
    """Handles WebSocket connection to sensor server."""
    
    def __init__(self, uri="ws://localhost:8765", on_data_callback=None):
        """
        Args:
            uri: WebSocket server URI
            on_data_callback: Function to call when data arrives: callback(address, values)
        """
        self.uri = uri
        self.on_data_callback = on_data_callback
        self.connected = False
        self.websocket = None
        self.last_update = None
        self.retry_count = 0
        self.max_retries = 30  # Try for ~30 seconds (1 sec intervals)
    
    async def connect(self, retry=True):
        """
        Establish WebSocket connection with retry logic.
        
        Args:
            retry: Whether to retry on failure
        """
        try:
            self.websocket = await websockets.connect(self.uri)
            self.connected = True
            self.retry_count = 0
            print(f"Connected to {self.uri}")
            return True
        except Exception as e:
            self.connected = False
            
            if retry and self.retry_count < self.max_retries:
                self.retry_count += 1
                print(f"Cannot connect to {self.uri} (attempt {self.retry_count}/{self.max_retries}), retrying in 1s...")
                await asyncio.sleep(1)
                return await self.connect(retry=True)
            else:
                print(f"Failed to connect to {self.uri}: {e}")
                return False
    
    async def disconnect(self):
        """Close WebSocket connection."""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
    
    async def listen(self):
        """
        Listen for incoming sensor data.
        This is a long-running task that should be awaited.
        Connects with automatic retry, then listens continuously.
        """
        # Try to connect with retries
        if not await self.connect(retry=True):
            print("Could not establish WebSocket connection. Sensor server may not be running.")
            return
        
        try:
            if not self.websocket:
                print("ERROR: WebSocket is None after connection")
                return
            
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    self.last_update = datetime.now()
                    
                    # Call the callback if provided
                    if self.on_data_callback:
                        # Extract address and all other fields as values
                        address = data.get("address", "")
                        values = {k: v for k, v in data.items() if k != "address"}
                        self.on_data_callback(address=address, values=values)
                except json.JSONDecodeError as e:
                    print(f"Invalid JSON received: {message} ({e})")
        except websockets.exceptions.ConnectionClosed:
            print("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            print(f"Error listening to WebSocket: {e}")
            self.connected = False
    
    def is_connected(self):
        """Check connection status."""
        return self.connected


# For testing
if __name__ == "__main__":
    def on_data(address, values):
        print(f"Received {address}: {values}")
    
    handler = WebSocketHandler(on_data_callback=on_data)
    
    # This would need to be run in an async context
    # asyncio.run(handler.listen())
