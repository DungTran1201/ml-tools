from fastapi import WebSocket
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps project_id to a list of connected WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps project_id to a list of WebSockets connected to the hardware telemetry stream
        self.hardware_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        logger.info(f"WebSocket connected for project {project_id}. Total: {len(self.active_connections[project_id])}")

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            if websocket in self.active_connections[project_id]:
                self.active_connections[project_id].remove(websocket)
                logger.info(f"WebSocket disconnected from project {project_id}.")
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast_to_project(self, project_id: str, message: dict):
        if project_id in self.active_connections:
            # We must handle disconnected sockets that weren't properly cleaned up
            dead_sockets = []
            msg_text = json.dumps(message)
            for connection in self.active_connections[project_id]:
                try:
                    await connection.send_text(msg_text)
                except Exception as e:
                    logger.warning(f"Error sending message to websocket: {e}")
                    dead_sockets.append(connection)
            
            for dead in dead_sockets:
                self.disconnect(dead, project_id)

    async def connect_hardware(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.hardware_connections:
            self.hardware_connections[project_id] = []
        self.hardware_connections[project_id].append(websocket)
        logger.info(f"Hardware WebSocket connected for project {project_id}. Total: {len(self.hardware_connections[project_id])}")

    def disconnect_hardware(self, websocket: WebSocket, project_id: str):
        if project_id in self.hardware_connections:
            if websocket in self.hardware_connections[project_id]:
                self.hardware_connections[project_id].remove(websocket)
                logger.info(f"Hardware WebSocket disconnected from project {project_id}.")
            if not self.hardware_connections[project_id]:
                del self.hardware_connections[project_id]

    async def broadcast_hardware(self, project_id: str, message: dict):
        if project_id in self.hardware_connections:
            dead_sockets = []
            msg_text = json.dumps(message)
            for connection in self.hardware_connections[project_id]:
                try:
                    await connection.send_text(msg_text)
                except Exception as e:
                    logger.warning(f"Error sending message to hardware websocket: {e}")
                    dead_sockets.append(connection)
            
            for dead in dead_sockets:
                self.disconnect_hardware(dead, project_id)

manager = ConnectionManager()
