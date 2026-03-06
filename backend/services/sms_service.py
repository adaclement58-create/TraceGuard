# SMS Notification Service for TRACEGUARD using Termii
import os
import logging
import httpx
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

TERMII_API_KEY = os.environ.get('TERMII_API_KEY', '')
TERMII_SENDER_ID = os.environ.get('TERMII_SENDER_ID', 'SAURIMART')
TERMII_BASE_URL = os.environ.get('TERMII_BASE_URL', 'https://api.ng.termii.com')

async def send_sms(phone: str, message: str) -> bool:
    """Send SMS using Termii API"""
    if not TERMII_API_KEY:
        logger.warning("Termii API key not configured")
        return False
    
    # Format phone number (ensure it starts with country code)
    formatted_phone = phone.replace('+', '').replace(' ', '').replace('-', '')
    if not formatted_phone.startswith('234') and formatted_phone.startswith('0'):
        formatted_phone = '234' + formatted_phone[1:]
    
    payload = {
        "to": formatted_phone,
        "from": TERMII_SENDER_ID,
        "sms": message,
        "type": "plain",
        "api_key": TERMII_API_KEY,
        "channel": "generic"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TERMII_BASE_URL}/api/sms/send",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                logger.info(f"SMS sent to {formatted_phone}")
                return True
            else:
                logger.error(f"SMS send failed: {response.text}")
                return False
    except Exception as e:
        logger.error(f"SMS error: {e}")
        return False


async def send_bulk_sms(phones: List[str], message: str) -> Dict[str, bool]:
    """Send SMS to multiple recipients"""
    results = {}
    for phone in phones:
        results[phone] = await send_sms(phone, message)
    return results


async def send_emergency_alert(
    contacts: List[Dict],
    sender_name: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None
) -> int:
    """Send emergency alert to all contacts"""
    location_str = ""
    if latitude and longitude:
        location_str = f"\nLocation: https://www.google.com/maps?q={latitude},{longitude}"
    
    message = f"EMERGENCY ALERT from {sender_name}!\nThis is an automated SOS alert. Please check on them immediately.{location_str}"
    
    sent_count = 0
    for contact in contacts:
        if await send_sms(contact.get('phone', ''), message):
            sent_count += 1
    
    return sent_count


async def send_trip_overdue_alert(
    contacts: List[Dict],
    traveler_name: str,
    destination: str,
    last_known_location: Optional[Dict] = None
) -> int:
    """Send trip overdue alert"""
    location_str = ""
    if last_known_location:
        lat = last_known_location.get('latitude')
        lng = last_known_location.get('longitude')
        if lat and lng:
            location_str = f"\nLast known location: https://www.google.com/maps?q={lat},{lng}"
    
    message = f"ALERT: {traveler_name} has not checked in from their trip to {destination}. Please try to contact them.{location_str}"
    
    sent_count = 0
    for contact in contacts:
        if await send_sms(contact.get('phone', ''), message):
            sent_count += 1
    
    return sent_count


async def send_zone_alert(
    contacts: List[Dict],
    person_name: str,
    zone_name: str,
    event_type: str  # 'enter' or 'exit'
) -> int:
    """Send geofence zone alert"""
    action = "entered" if event_type == "enter" else "left"
    message = f"TRACEGUARD: {person_name} has {action} the safe zone '{zone_name}'."
    
    sent_count = 0
    for contact in contacts:
        if await send_sms(contact.get('phone', ''), message):
            sent_count += 1
    
    return sent_count
