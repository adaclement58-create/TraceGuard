# AI Analysis Service for TRACEGUARD
import os
import math
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid

logger = logging.getLogger(__name__)

async def analyze_incident_with_ai(
    db,
    incident_id: str,
    user_email: str
) -> Dict[str, Any]:
    """Analyze an incident using AI for risk assessment"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    incident = await db.incidents.find_one({"id": incident_id})
    if not incident:
        return None
    
    # Get related data
    pings = await db.location_pings.find({"incident_id": incident_id}).sort("timestamp", 1).to_list(100)
    evidence = await db.evidence.find({"incident_id": incident_id}).to_list(50)
    
    # Build context
    context = f"""
    Incident Type: {incident.get('incident_type', 'unknown')}
    Severity: {incident.get('severity', 'unknown')}
    Status: {incident.get('status', 'unknown')}
    Duration: {incident.get('duration_minutes', 0)} minutes
    Location Pings: {len(pings)}
    Evidence Items: {len(evidence)}
    Alerts Sent: {incident.get('alerts_sent_count', 0)}
    Time: {incident.get('created_at', '')}
    """
    
    if pings and len(pings) >= 2:
        first_ping = pings[0]
        last_ping = pings[-1]
        if first_ping.get('latitude') and last_ping.get('latitude'):
            lat1, lon1 = first_ping['latitude'], first_ping['longitude']
            lat2, lon2 = last_ping['latitude'], last_ping['longitude']
            R = 6371
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance = R * c
            context += f"\nTotal movement during incident: {distance:.2f} km"
    
    EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
    if not EMERGENT_LLM_KEY:
        raise ValueError("AI analysis not configured")
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"incident-analysis-{incident_id}",
        system_message="""You are a safety analyst for TRACEGUARD emergency response system. 
        Analyze incident data and provide:
        1. Risk Assessment (Low/Medium/High/Critical)
        2. Key Observations
        3. Recommended Actions
        4. Pattern Insights
        Be concise and actionable. Format as JSON with keys: risk_level, observations, recommendations, patterns"""
    ).with_model("openai", "gpt-5.2")
    
    message = UserMessage(text=f"Analyze this safety incident:\n{context}")
    response = await chat.send_message(message)
    
    # Store analysis
    analysis_doc = {
        "id": str(uuid.uuid4()),
        "incident_id": incident_id,
        "analysis": response,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "analyzed_by": user_email
    }
    await db.incident_analyses.insert_one(analysis_doc)
    
    return {
        "incident_id": incident_id,
        "analysis": response,
        "created_at": analysis_doc["created_at"]
    }


async def get_area_risk_with_ai(
    db,
    latitude: float,
    longitude: float,
    radius_km: float = 5.0
) -> Dict[str, Any]:
    """Get AI-powered risk assessment for an area"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Find incidents in the area
    incidents = await db.incidents.find({
        "latitude": {"$exists": True},
        "longitude": {"$exists": True}
    }).to_list(1000)
    
    # Filter by distance
    nearby_incidents = []
    for inc in incidents:
        if inc.get('latitude') and inc.get('longitude'):
            lat1, lon1 = latitude, longitude
            lat2, lon2 = inc['latitude'], inc['longitude']
            R = 6371
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            distance = R * c
            if distance <= radius_km:
                nearby_incidents.append({
                    "type": inc.get("incident_type"),
                    "severity": inc.get("severity"),
                    "time": inc.get("created_at"),
                    "distance_km": round(distance, 2)
                })
    
    context = f"""
    Location: {latitude}, {longitude}
    Search Radius: {radius_km} km
    Incidents Found: {len(nearby_incidents)}
    
    Recent Incidents in Area:
    {nearby_incidents[:20]}
    """
    
    EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
    if not EMERGENT_LLM_KEY:
        return {
            "risk_level": "unknown",
            "message": "AI analysis not configured",
            "incidents_count": len(nearby_incidents)
        }
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"area-risk-{latitude}-{longitude}",
        system_message="""You are a safety analyst. Analyze area incident data and provide:
        1. Overall Risk Level (Low/Medium/High)
        2. Time-based patterns (if any)
        3. Safety recommendations for this area
        Be brief and practical. Format as JSON with keys: risk_level, patterns, recommendations"""
    ).with_model("openai", "gpt-5.2")
    
    message = UserMessage(text=f"Analyze safety risk for this area:\n{context}")
    response = await chat.send_message(message)
    
    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius_km,
        "incidents_count": len(nearby_incidents),
        "analysis": response
    }
