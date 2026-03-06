# WebSocket Manager for TRACEGUARD Real-time Updates
import logging
import json
from typing import Dict, List, Any
from fastapi import WebSocket
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_email: str):
        """Connect a user's WebSocket"""
        await websocket.accept()
        if user_email not in self.active_connections:
            self.active_connections[user_email] = []
        self.active_connections[user_email].append(websocket)
        logger.info(f"[WS] User connected: {user_email}")
    
    def disconnect(self, websocket: WebSocket, user_email: str):
        """Disconnect a user's WebSocket"""
        if user_email in self.active_connections:
            if websocket in self.active_connections[user_email]:
                self.active_connections[user_email].remove(websocket)
            if not self.active_connections[user_email]:
                del self.active_connections[user_email]
        logger.info(f"[WS] User disconnected: {user_email}")
    
    async def send_personal(self, user_email: str, message: dict):
        """Send message to a specific user"""
        if user_email in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_email]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"[WS] Send error to {user_email}: {e}")
                    disconnected.append(connection)
            
            # Clean up disconnected sockets
            for ws in disconnected:
                self.disconnect(ws, user_email)
    
    async def broadcast_to_users(self, user_emails: List[str], message: dict):
        """Broadcast message to multiple users"""
        for email in user_emails:
            await self.send_personal(email, message)
    
    async def broadcast_to_contacts(self, db, user_email: str, message: dict):
        """Broadcast to user's trusted contacts"""
        contacts = await db.contacts.find({"owner_email": user_email}).to_list(100)
        for contact in contacts:
            contact_email = contact.get("email")
            if contact_email and contact_email in self.active_connections:
                await self.send_personal(contact_email, message)
    
    async def broadcast_to_family(self, db, family_owner: str, message: dict):
        """Broadcast to family members"""
        members = await db.family_members.find({"owner_email": family_owner}).to_list(100)
        for member in members:
            member_email = member.get("member_email")
            if member_email and member_email in self.active_connections:
                await self.send_personal(member_email, message)
    
    def get_connected_users(self) -> List[str]:
        """Get list of currently connected user emails"""
        return list(self.active_connections.keys())
    
    def is_user_connected(self, user_email: str) -> bool:
        """Check if a user is currently connected"""
        return user_email in self.active_connections


# Global instance
ws_manager = ConnectionManager()


async def notify_sos_activated(db, user_email: str, incident_id: str):
    """Notify contacts when SOS is activated"""
    from services.push_service import send_push_notification
    
    await ws_manager.broadcast_to_contacts(db, user_email, {
        "type": "sos_activated",
        "data": {
            "from_email": user_email,
            "incident_id": incident_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })
    
    # Also send push notification
    contacts = await db.contacts.find({"owner_email": user_email}).to_list(100)
    for contact in contacts:
        if contact.get("email"):
            await send_push_notification(
                db,
                contact["email"],
                "EMERGENCY SOS ALERT",
                f"Emergency alert from {user_email}",
                {"type": "sos", "incident_id": incident_id}
            )


async def notify_location_update(db, user_email: str, latitude: float, longitude: float):
    """Notify family members of location update"""
    await ws_manager.broadcast_to_family(db, user_email, {
        "type": "family_member_location",
        "data": {
            "email": user_email,
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })


async def notify_trip_update(db, user_email: str, trip_id: str, status: str):
    """Notify contacts of trip status change"""
    await ws_manager.broadcast_to_contacts(db, user_email, {
        "type": "trip_update",
        "data": {
            "from_email": user_email,
            "trip_id": trip_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })
