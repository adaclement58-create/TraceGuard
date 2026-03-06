from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext
import re
import asyncio
from contextlib import asynccontextmanager
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'traceguard_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 10080))
TERMII_API_KEY = os.environ.get('TERMII_API_KEY', '')
TERMII_SENDER_ID = os.environ.get('TERMII_SENDER_ID', 'SAURIMART')
TERMII_BASE_URL = os.environ.get('TERMII_BASE_URL', 'https://api.ng.termii.com')
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer(auto_error=False)

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== SCHEDULED JOBS =====================

async def check_trip_overdue():
    """Background job to check for overdue trips and escalate"""
    logger.info("Running trip overdue check...")
    try:
        now = datetime.now(timezone.utc)
        
        # Find active trips
        active_trips = await db.trips.find({"status": {"$in": ["active", "overdue"]}}).to_list(1000)
        
        for trip in active_trips:
            try:
                # Parse ETA
                eta_str = trip.get("eta", "")
                if isinstance(eta_str, str):
                    # Handle different datetime formats
                    if 'T' in eta_str:
                        if eta_str.endswith('Z'):
                            eta = datetime.fromisoformat(eta_str.replace('Z', '+00:00'))
                        elif '+' in eta_str or '-' in eta_str[-6:]:
                            eta = datetime.fromisoformat(eta_str)
                        else:
                            eta = datetime.fromisoformat(eta_str).replace(tzinfo=timezone.utc)
                    else:
                        eta = datetime.fromisoformat(eta_str).replace(tzinfo=timezone.utc)
                else:
                    eta = eta_str if eta_str.tzinfo else eta_str.replace(tzinfo=timezone.utc)
                
                # Parse last check-in
                last_check_in_str = trip.get("last_check_in", "")
                if isinstance(last_check_in_str, str):
                    if 'T' in last_check_in_str:
                        if last_check_in_str.endswith('Z'):
                            last_check_in = datetime.fromisoformat(last_check_in_str.replace('Z', '+00:00'))
                        elif '+' in last_check_in_str or '-' in last_check_in_str[-6:]:
                            last_check_in = datetime.fromisoformat(last_check_in_str)
                        else:
                            last_check_in = datetime.fromisoformat(last_check_in_str).replace(tzinfo=timezone.utc)
                    else:
                        last_check_in = datetime.fromisoformat(last_check_in_str).replace(tzinfo=timezone.utc)
                else:
                    last_check_in = last_check_in_str if last_check_in_str.tzinfo else last_check_in_str.replace(tzinfo=timezone.utc)
                
                interval_minutes = trip.get("check_in_interval_minutes", 30)
                max_missed = trip.get("max_missed_before_escalation", 3)
                
                # Calculate missed check-ins
                minutes_since_checkin = (now - last_check_in).total_seconds() / 60
                missed = int(minutes_since_checkin / interval_minutes)
                
                # Update missed count
                await db.trips.update_one(
                    {"id": trip["id"]},
                    {"$set": {"missed_check_ins": missed}}
                )
                
                # Check if should escalate
                should_escalate = missed >= max_missed or now > eta
                
                if should_escalate and trip["status"] != "escalated":
                    # Mark trip as escalated
                    await db.trips.update_one(
                        {"id": trip["id"]},
                        {"$set": {"status": "escalated"}}
                    )
                    
                    # Create incident
                    incident_id = str(uuid.uuid4())
                    await db.incidents.insert_one({
                        "id": incident_id,
                        "owner_email": trip["owner_email"],
                        "owner_name": trip.get("owner_name", trip["owner_email"]),
                        "incident_type": "trip_overdue",
                        "severity": "high",
                        "status": "active",
                        "last_known_lat": None,
                        "last_known_lng": None,
                        "alerts_sent_count": 0,
                        "location_pings_count": 0,
                        "evidence_count": 0,
                        "created_at": now.isoformat(),
                        "resolved_at": None
                    })
                    
                    # Send alerts
                    contacts = await db.trusted_contacts.find({"owner_email": trip["owner_email"]}).to_list(100)
                    owner_name = trip.get("owner_name", trip["owner_email"])
                    
                    for contact in contacts:
                        if contact.get("phone"):
                            message = f"TRACEGUARD ALERT: {owner_name} has not checked in on their trip to {trip['destination']}. They may need help. Incident ID: {incident_id[:8]}"
                            await send_sms(contact["phone"], message)
                    
                    # Log audit
                    await db.audit_logs.insert_one({
                        "id": str(uuid.uuid4()),
                        "actor_email": "system",
                        "action": "trip_escalated",
                        "target_type": "trip",
                        "target_id": trip["id"],
                        "timestamp": now.isoformat()
                    })
                    
                    logger.info(f"Trip {trip['id']} escalated for user {trip['owner_email']}")
                
                elif missed > 0 and trip["status"] == "active":
                    # Mark as overdue
                    await db.trips.update_one(
                        {"id": trip["id"]},
                        {"$set": {"status": "overdue"}}
                    )
            except Exception as trip_error:
                logger.warning(f"Error processing trip {trip.get('id')}: {trip_error}")
                continue
                
    except Exception as e:
        logger.error(f"Trip overdue check failed: {e}")

async def check_geofences():
    """Background job to check geofence transitions"""
    logger.info("Running geofence check...")
    try:
        # Get all user locations
        user_locations = await db.user_locations.find({}).to_list(10000)
        
        for loc in user_locations:
            user_email = loc["owner_email"]
            user_lat = loc["latitude"]
            user_lng = loc["longitude"]
            
            # Get user's active zones
            zones = await db.safe_zones.find({
                "owner_email": user_email,
                "is_active": True
            }).to_list(100)
            
            for zone in zones:
                distance = haversine_distance(
                    user_lat, user_lng,
                    zone["latitude"], zone["longitude"]
                )
                
                is_inside = distance <= zone["radius"]
                was_inside = zone.get("last_event") == "enter"
                
                # Detect transition
                if is_inside and not was_inside:
                    # Entered zone
                    await db.safe_zones.update_one(
                        {"id": zone["id"]},
                        {"$set": {"last_event": "enter"}}
                    )
                    
                    if zone.get("notify_on_enter"):
                        await notify_zone_transition(user_email, zone, "enter")
                        
                elif not is_inside and was_inside:
                    # Exited zone
                    await db.safe_zones.update_one(
                        {"id": zone["id"]},
                        {"$set": {"last_event": "exit"}}
                    )
                    
                    if zone.get("notify_on_exit"):
                        await notify_zone_transition(user_email, zone, "exit")
                        
    except Exception as e:
        logger.error(f"Geofence check failed: {e}")

async def notify_zone_transition(user_email: str, zone: dict, event_type: str):
    """Send notifications for zone transitions"""
    contacts = await db.trusted_contacts.find({"owner_email": user_email}).to_list(100)
    user = await db.users.find_one({"email": user_email})
    user_name = user.get("full_name", user_email) if user else user_email
    
    action = "entered" if event_type == "enter" else "left"
    message = f"TRACEGUARD: {user_name} has {action} {zone['name']}"
    
    for contact in contacts:
        if contact.get("phone") and contact.get("notification_preference") in ["sms", "both"]:
            await send_sms(contact["phone"], message)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Background task runner
scheduler_task = None

async def run_scheduled_jobs():
    """Run scheduled jobs in the background"""
    while True:
        try:
            await check_trip_overdue()
            await check_geofences()
        except Exception as e:
            logger.error(f"Scheduled job error: {e}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    global scheduler_task
    # Start background scheduler
    scheduler_task = asyncio.create_task(run_scheduled_jobs())
    logger.info("Background scheduler started")
    yield
    # Shutdown
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    client.close()
    logger.info("Application shutdown complete")

app = FastAPI(title="TRACEGUARD API", version="1.0.0", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ===================== PYDANTIC MODELS =====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class EmergencyProfileCreate(BaseModel):
    phone_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    emergency_note: Optional[str] = None

class EmergencyProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    emergency_note: Optional[str] = None
    resolution_pin: Optional[str] = None
    duress_pin: Optional[str] = None
    kidnap_mode: Optional[bool] = None
    sms_fallback: Optional[bool] = None
    auto_evidence_capture: Optional[bool] = None

class TrustedContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = "contact"
    relationship: Optional[str] = None
    notification_preference: str = "both"

class TripCreate(BaseModel):
    destination: str
    eta: str
    notes: Optional[str] = None
    check_in_interval_minutes: int = 30
    max_missed_before_escalation: int = 3

class SafeZoneCreate(BaseModel):
    name: str
    zone_type: str = "other"
    latitude: float
    longitude: float
    radius: int = 200
    notify_on_enter: bool = True
    notify_on_exit: bool = True

class LocationPingCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    battery: Optional[int] = None
    network: Optional[str] = None
    incident_id: Optional[str] = None

class IncidentCreate(BaseModel):
    incident_type: str = "sos"
    severity: str = "high"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class EvidenceCreate(BaseModel):
    incident_id: str
    evidence_type: str
    file_url: str
    sha256_hash: str
    duration: Optional[int] = None

class SendOTPRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    token: str

class PaymentInitRequest(BaseModel):
    plan: str
    callback_url: str

class OrganizationCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    address: Optional[str] = None
    employee_count: int = 10

# ===================== HELPER FUNCTIONS =====================

def hash_pin(pin: str) -> str:
    """SHA-256 hash a PIN"""
    return hashlib.sha256(pin.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email:
            return await db.users.find_one({"email": email}, {"_id": 0})
    except JWTError:
        pass
    return None

def normalize_phone(phone: str) -> str:
    """Normalize Nigerian phone number to international format"""
    cleaned = re.sub(r'\D', '', phone)
    if cleaned.startswith('0'):
        return '234' + cleaned[1:]
    if cleaned.startswith('234'):
        return cleaned
    return cleaned

async def send_sms(phone: str, message: str) -> dict:
    """Send SMS via Termii API"""
    if not TERMII_API_KEY:
        logger.warning("Termii API key not configured, skipping SMS")
        return {"status": "skipped", "reason": "no_api_key"}
    
    url = f"{TERMII_BASE_URL}/api/sms/send"
    payload = {
        "to": normalize_phone(phone),
        "from": TERMII_SENDER_ID,
        "sms": message,
        "type": "plain",
        "channel": "dnd",
        "api_key": TERMII_API_KEY
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            return response.json()
    except Exception as e:
        logger.error(f"SMS send failed: {e}")
        return {"status": "error", "message": str(e)}

async def send_email_alert(to_email: str, subject: str, body: str):
    """Send email alert (simplified - would integrate with email service)"""
    logger.info(f"Email alert to {to_email}: {subject}")
    # In production, integrate with SendGrid, SES, etc.

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "email_verified": False
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_data.email})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            role="user",
            created_at=user_doc["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["email"]})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            role=user.get("role", "user"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "user"),
        created_at=user["created_at"]
    )

# ===================== OTP ENDPOINTS =====================

@api_router.post("/auth/send-otp")
async def send_verification_otp(data: SendOTPRequest):
    """Send email OTP for verification"""
    token = ''.join([str(uuid.uuid4().hex[:6]).upper()])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.otp_tokens.update_one(
        {"email": data.email},
        {"$set": {
            "email": data.email,
            "token": token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Send email (simplified)
    logger.info(f"OTP for {data.email}: {token}")
    await send_email_alert(
        data.email,
        "TRACEGUARD Verification Code",
        f"Your verification code is: {token}\n\nThis code expires in 15 minutes."
    )
    
    return {"status": "sent", "message": "Verification code sent to email"}

@api_router.post("/auth/verify-otp")
async def verify_otp(data: VerifyOTPRequest):
    """Verify email OTP"""
    otp_record = await db.otp_tokens.find_one({"email": data.email}, {"_id": 0})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found for this email")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")
    
    if otp_record["token"].upper() != data.token.upper():
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark email as verified
    await db.users.update_one({"email": data.email}, {"$set": {"email_verified": True}})
    await db.otp_tokens.delete_one({"email": data.email})
    
    return {"status": "verified", "message": "Email verified successfully"}

# ===================== EMERGENCY PROFILE ENDPOINTS =====================

@api_router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    profile = await db.emergency_profiles.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not profile:
        return {"status": "no_profile"}
    return profile

@api_router.post("/profile")
async def create_profile(data: EmergencyProfileCreate, user: dict = Depends(get_current_user)):
    profile_id = str(uuid.uuid4())
    profile_doc = {
        "id": profile_id,
        "owner_email": user["email"],
        "full_name": user["full_name"],
        "phone_number": data.phone_number,
        "blood_group": data.blood_group,
        "medical_conditions": data.medical_conditions,
        "emergency_note": data.emergency_note,
        "status": "safe",
        "email_verified": user.get("email_verified", False),
        "resolution_pin_hash": None,
        "duress_pin_hash": None,
        "kidnap_mode": False,
        "sms_fallback": True,
        "auto_evidence_capture": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.emergency_profiles.insert_one(profile_doc)
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_email": user["email"],
        "action": "profile_created",
        "target_type": "emergency_profile",
        "target_id": profile_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if "_id" in profile_doc: del profile_doc["_id"]
    return profile_doc

@api_router.put("/profile")
async def update_profile(data: EmergencyProfileUpdate, user: dict = Depends(get_current_user)):
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.full_name is not None:
        update_fields["full_name"] = data.full_name
        await db.users.update_one({"email": user["email"]}, {"$set": {"full_name": data.full_name}})
    if data.phone_number is not None:
        update_fields["phone_number"] = data.phone_number
    if data.blood_group is not None:
        update_fields["blood_group"] = data.blood_group
    if data.medical_conditions is not None:
        update_fields["medical_conditions"] = data.medical_conditions
    if data.emergency_note is not None:
        update_fields["emergency_note"] = data.emergency_note
    if data.resolution_pin is not None:
        update_fields["resolution_pin_hash"] = hash_pin(data.resolution_pin)
    if data.duress_pin is not None:
        update_fields["duress_pin_hash"] = hash_pin(data.duress_pin)
    if data.kidnap_mode is not None:
        update_fields["kidnap_mode"] = data.kidnap_mode
    if data.sms_fallback is not None:
        update_fields["sms_fallback"] = data.sms_fallback
    if data.auto_evidence_capture is not None:
        update_fields["auto_evidence_capture"] = data.auto_evidence_capture
    
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": update_fields}
    )
    
    profile = await db.emergency_profiles.find_one({"owner_email": user["email"]}, {"_id": 0})
    return profile

# ===================== TRUSTED CONTACTS ENDPOINTS =====================

@api_router.get("/contacts")
async def get_contacts(user: dict = Depends(get_current_user)):
    contacts = await db.trusted_contacts.find({"owner_email": user["email"]}, {"_id": 0}).to_list(100)
    return contacts

@api_router.post("/contacts")
async def create_contact(data: TrustedContactCreate, user: dict = Depends(get_current_user)):
    # Check subscription limit
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    plan = subscription.get("plan", "basic") if subscription else "basic"
    
    existing_count = await db.trusted_contacts.count_documents({"owner_email": user["email"]})
    if plan == "basic" and existing_count >= 3:
        raise HTTPException(status_code=403, detail="Contact limit reached. Upgrade to Premium for unlimited contacts.")
    
    contact_id = str(uuid.uuid4())
    contact_doc = {
        "id": contact_id,
        "owner_email": user["email"],
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "role": data.role,
        "relationship": data.relationship,
        "notification_preference": data.notification_preference,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trusted_contacts.insert_one(contact_doc)
    
    if "_id" in contact_doc: del contact_doc["_id"]
    return contact_doc

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: dict = Depends(get_current_user)):
    result = await db.trusted_contacts.delete_one({"id": contact_id, "owner_email": user["email"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}

# ===================== INCIDENTS ENDPOINTS =====================

@api_router.get("/incidents")
async def get_incidents(user: dict = Depends(get_current_user)):
    incidents = await db.incidents.find({"owner_email": user["email"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return incidents

@api_router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str, user: dict = Depends(get_current_user)):
    incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Check access
    if incident["owner_email"] != user["email"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get location pings
    pings = await db.location_pings.find({"incident_id": incident_id}, {"_id": 0}).to_list(1000)
    incident["location_pings"] = pings
    
    # Get evidence
    evidence = await db.evidence.find({"incident_id": incident_id}, {"_id": 0}).to_list(100)
    incident["evidence"] = evidence
    
    return incident

@api_router.post("/incidents")
async def create_incident(data: IncidentCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    incident_id = str(uuid.uuid4())
    incident_doc = {
        "id": incident_id,
        "owner_email": user["email"],
        "owner_name": user["full_name"],
        "incident_type": data.incident_type,
        "severity": data.severity,
        "status": "active",
        "last_known_lat": data.latitude,
        "last_known_lng": data.longitude,
        "last_known_address": None,
        "alerts_sent_count": 0,
        "location_pings_count": 0,
        "evidence_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
        "resolution_reason": None
    }
    await db.incidents.insert_one(incident_doc)
    
    # Update profile status
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": {"status": "sos_active"}}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_email": user["email"],
        "action": "sos_activated",
        "target_type": "incident",
        "target_id": incident_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Send alerts in background
    background_tasks.add_task(send_alerts_task, user["email"], incident_id, user["full_name"])
    
    if "_id" in incident_doc: del incident_doc["_id"]
    return incident_doc

@api_router.put("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, pin: str, user: dict = Depends(get_current_user)):
    incident = await db.incidents.find_one({"id": incident_id, "owner_email": user["email"]}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    profile = await db.emergency_profiles.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=400, detail="No profile found")
    
    pin_hash = hash_pin(pin)
    
    # Check for duress PIN (silent escalation)
    if profile.get("duress_pin_hash") and pin_hash == profile["duress_pin_hash"]:
        # Silently escalate - don't resolve
        await db.incidents.update_one(
            {"id": incident_id},
            {"$set": {"status": "escalated", "severity": "critical"}}
        )
        # Send secret escalation alert
        contacts = await db.trusted_contacts.find({"owner_email": user["email"]}, {"_id": 0}).to_list(100)
        for contact in contacts:
            if contact.get("phone"):
                await send_sms(
                    contact["phone"],
                    f"TRACEGUARD DURESS ALERT: {user['full_name']} may be under coercion. Incident #{incident_id[:8]}. Contact authorities immediately."
                )
        return {"status": "resolved", "message": "Incident resolved"}  # Fake success
    
    # Check resolution PIN
    if profile.get("resolution_pin_hash") and pin_hash != profile["resolution_pin_hash"]:
        raise HTTPException(status_code=400, detail="Invalid PIN")
    
    # Actually resolve
    await db.incidents.update_one(
        {"id": incident_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolution_reason": "user_resolved"
        }}
    )
    
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": {"status": "safe"}}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_email": user["email"],
        "action": "sos_resolved",
        "target_type": "incident",
        "target_id": incident_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "resolved", "message": "Incident resolved successfully"}

async def send_alerts_task(owner_email: str, incident_id: str, owner_name: str):
    """Background task to send alerts to all contacts"""
    contacts = await db.trusted_contacts.find({"owner_email": owner_email}, {"_id": 0}).to_list(100)
    
    profile = await db.emergency_profiles.find_one({"owner_email": owner_email}, {"_id": 0})
    location_text = ""
    if profile and profile.get("last_known_lat"):
        location_text = f"\nLast Location: {profile.get('last_known_lat')}, {profile.get('last_known_lng')}"
    
    alerts_sent = 0
    for contact in contacts:
        message = f"TRACEGUARD ALERT: {owner_name} has activated SOS!{location_text}\nIncident ID: {incident_id[:8]}\nPlease check on them immediately."
        
        pref = contact.get("notification_preference", "both")
        
        if pref in ["sms", "both"] and contact.get("phone"):
            await send_sms(contact["phone"], message)
            alerts_sent += 1
        
        if pref in ["push", "both"] and contact.get("email"):
            await send_email_alert(contact["email"], "TRACEGUARD EMERGENCY ALERT", message)
            alerts_sent += 1
    
    # Update incident with alert count
    await db.incidents.update_one(
        {"id": incident_id},
        {"$set": {"alerts_sent_count": alerts_sent}}
    )

@api_router.post("/incidents/test-alert")
async def send_test_alert(user: dict = Depends(get_current_user)):
    """Send a test alert to all contacts"""
    contacts = await db.trusted_contacts.find({"owner_email": user["email"]}, {"_id": 0}).to_list(100)
    
    if not contacts:
        raise HTTPException(status_code=400, detail="No contacts to alert")
    
    message = f"TRACEGUARD TEST: This is a test alert from {user['full_name']}. No emergency - just testing the system."
    
    sent_count = 0
    for contact in contacts:
        if contact.get("phone"):
            await send_sms(contact["phone"], message)
            sent_count += 1
        if contact.get("email"):
            await send_email_alert(contact["email"], "TRACEGUARD TEST ALERT", message)
            sent_count += 1
    
    return {"status": "sent", "alerts_sent": sent_count}

# ===================== LOCATION ENDPOINTS =====================

@api_router.post("/location/ping")
async def ping_location(data: LocationPingCreate, user: dict = Depends(get_current_user)):
    """Record location ping during active incident"""
    ping_id = str(uuid.uuid4())
    ping_doc = {
        "id": ping_id,
        "owner_email": user["email"],
        "incident_id": data.incident_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "accuracy": data.accuracy,
        "battery": data.battery,
        "network": data.network,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.location_pings.insert_one(ping_doc)
    
    # Update incident last known location
    if data.incident_id:
        await db.incidents.update_one(
            {"id": data.incident_id},
            {
                "$set": {
                    "last_known_lat": data.latitude,
                    "last_known_lng": data.longitude
                },
                "$inc": {"location_pings_count": 1}
            }
        )
    
    # Update user location
    await db.user_locations.update_one(
        {"owner_email": user["email"]},
        {"$set": {
            "owner_email": user["email"],
            "latitude": data.latitude,
            "longitude": data.longitude,
            "accuracy": data.accuracy,
            "battery": data.battery,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"status": "recorded", "ping_id": ping_id}

@api_router.put("/location/update")
async def update_user_location(data: LocationPingCreate, user: dict = Depends(get_current_user)):
    """Update user's current location"""
    await db.user_locations.update_one(
        {"owner_email": user["email"]},
        {"$set": {
            "owner_email": user["email"],
            "latitude": data.latitude,
            "longitude": data.longitude,
            "accuracy": data.accuracy,
            "battery": data.battery,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"status": "updated"}

# ===================== SAFE ZONES ENDPOINTS =====================

@api_router.get("/safe-zones")
async def get_safe_zones(user: dict = Depends(get_current_user)):
    zones = await db.safe_zones.find({"owner_email": user["email"]}, {"_id": 0}).to_list(100)
    return zones

@api_router.post("/safe-zones")
async def create_safe_zone(data: SafeZoneCreate, user: dict = Depends(get_current_user)):
    zone_id = str(uuid.uuid4())
    zone_doc = {
        "id": zone_id,
        "owner_email": user["email"],
        "name": data.name,
        "zone_type": data.zone_type,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "radius": data.radius,
        "notify_on_enter": data.notify_on_enter,
        "notify_on_exit": data.notify_on_exit,
        "is_active": True,
        "last_event": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.safe_zones.insert_one(zone_doc)
    
    if "_id" in zone_doc: del zone_doc["_id"]
    return zone_doc

@api_router.put("/safe-zones/{zone_id}")
async def update_safe_zone(zone_id: str, is_active: bool, user: dict = Depends(get_current_user)):
    result = await db.safe_zones.update_one(
        {"id": zone_id, "owner_email": user["email"]},
        {"$set": {"is_active": is_active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"status": "updated"}

@api_router.delete("/safe-zones/{zone_id}")
async def delete_safe_zone(zone_id: str, user: dict = Depends(get_current_user)):
    result = await db.safe_zones.delete_one({"id": zone_id, "owner_email": user["email"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"status": "deleted"}

@api_router.post("/safe-zones/geofence-alert")
async def geofence_alert(zone_id: str, event_type: str, user: dict = Depends(get_current_user)):
    """Handle geofence enter/exit events"""
    zone = await db.safe_zones.find_one({"id": zone_id, "owner_email": user["email"]}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    
    # Update zone last event
    await db.safe_zones.update_one(
        {"id": zone_id},
        {"$set": {"last_event": event_type}}
    )
    
    # Send notifications if enabled
    should_notify = (event_type == "enter" and zone.get("notify_on_enter")) or \
                   (event_type == "exit" and zone.get("notify_on_exit"))
    
    if should_notify:
        contacts = await db.trusted_contacts.find({"owner_email": user["email"]}, {"_id": 0}).to_list(100)
        message = f"TRACEGUARD: {user['full_name']} has {'entered' if event_type == 'enter' else 'left'} {zone['name']}"
        
        for contact in contacts:
            if contact.get("phone") and contact.get("notification_preference") in ["sms", "both"]:
                await send_sms(contact["phone"], message)
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_email": user["email"],
        "action": "location_shared",
        "target_type": "safe_zone",
        "target_id": zone_id,
        "details": {"event_type": event_type, "zone_name": zone["name"]},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "processed"}

# ===================== TRIP MONITOR ENDPOINTS =====================

@api_router.get("/trips")
async def get_trips(user: dict = Depends(get_current_user)):
    trips = await db.trips.find({"owner_email": user["email"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return trips

@api_router.post("/trips")
async def create_trip(data: TripCreate, user: dict = Depends(get_current_user)):
    trip_id = str(uuid.uuid4())
    trip_doc = {
        "id": trip_id,
        "owner_email": user["email"],
        "owner_name": user["full_name"],
        "destination": data.destination,
        "eta": data.eta,
        "notes": data.notes,
        "check_in_interval_minutes": data.check_in_interval_minutes,
        "max_missed_before_escalation": data.max_missed_before_escalation,
        "status": "active",
        "last_check_in": datetime.now(timezone.utc).isoformat(),
        "missed_check_ins": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trips.insert_one(trip_doc)
    
    # Update profile status
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": {"status": "trip_active"}}
    )
    
    if "_id" in trip_doc: del trip_doc["_id"]
    return trip_doc

@api_router.post("/trips/{trip_id}/check-in")
async def trip_check_in(trip_id: str, user: dict = Depends(get_current_user)):
    result = await db.trips.update_one(
        {"id": trip_id, "owner_email": user["email"]},
        {"$set": {
            "last_check_in": datetime.now(timezone.utc).isoformat(),
            "missed_check_ins": 0,
            "status": "active"
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {"status": "checked_in"}

@api_router.post("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, user: dict = Depends(get_current_user)):
    result = await db.trips.update_one(
        {"id": trip_id, "owner_email": user["email"]},
        {"$set": {"status": "completed"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Update profile status
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": {"status": "safe"}}
    )
    
    return {"status": "completed"}

@api_router.post("/trips/{trip_id}/cancel")
async def cancel_trip(trip_id: str, user: dict = Depends(get_current_user)):
    result = await db.trips.update_one(
        {"id": trip_id, "owner_email": user["email"]},
        {"$set": {"status": "cancelled"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    await db.emergency_profiles.update_one(
        {"owner_email": user["email"]},
        {"$set": {"status": "safe"}}
    )
    
    return {"status": "cancelled"}

# ===================== EVIDENCE ENDPOINTS =====================

@api_router.get("/evidence")
async def get_evidence(user: dict = Depends(get_current_user)):
    evidence = await db.evidence.find({"owner_email": user["email"]}, {"_id": 0}).sort("captured_at", -1).to_list(100)
    return evidence

@api_router.post("/evidence")
async def upload_evidence(data: EvidenceCreate, user: dict = Depends(get_current_user)):
    evidence_id = str(uuid.uuid4())
    evidence_doc = {
        "id": evidence_id,
        "owner_email": user["email"],
        "incident_id": data.incident_id,
        "evidence_type": data.evidence_type,
        "file_url": data.file_url,
        "sha256_hash": data.sha256_hash,
        "duration": data.duration,
        "is_uploaded": True,
        "access_restricted": True,
        "captured_at": datetime.now(timezone.utc).isoformat()
    }
    await db.evidence.insert_one(evidence_doc)
    
    # Update incident evidence count
    await db.incidents.update_one(
        {"id": data.incident_id},
        {"$inc": {"evidence_count": 1}}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_email": user["email"],
        "action": "evidence_uploaded",
        "target_type": "evidence",
        "target_id": evidence_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if "_id" in evidence_doc: del evidence_doc["_id"]
    return evidence_doc

# ===================== SUBSCRIPTION ENDPOINTS =====================

PLAN_PRICES = {
    "basic": 0,
    "premium": 250000,  # ₦2,500 in kobo
    "family": 500000    # ₦5,000 in kobo
}

@api_router.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not subscription:
        return {"plan": "basic", "status": "active"}
    return subscription

@api_router.post("/subscription/initialize")
async def initialize_payment(data: PaymentInitRequest, user: dict = Depends(get_current_user)):
    if data.plan not in PLAN_PRICES or PLAN_PRICES[data.plan] == 0:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    amount = PLAN_PRICES[data.plan]
    reference = f"tg_{uuid.uuid4().hex[:16]}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "email": user["email"],
                "amount": amount,
                "reference": reference,
                "callback_url": data.callback_url,
                "metadata": {
                    "plan": data.plan,
                    "user_email": user["email"]
                }
            }
        )
        result = response.json()
    
    if result.get("status"):
        return {
            "authorization_url": result["data"]["authorization_url"],
            "reference": result["data"]["reference"]
        }
    
    raise HTTPException(status_code=400, detail=result.get("message", "Payment initialization failed"))

@api_router.get("/subscription/verify/{reference}")
async def verify_payment(reference: str, user: dict = Depends(get_current_user)):
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
        )
        result = response.json()
    
    if result.get("status") and result["data"]["status"] == "success":
        plan = result["data"]["metadata"].get("plan", "premium")
        
        # Calculate subscription period
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=30)
        
        await db.subscriptions.update_one(
            {"owner_email": user["email"]},
            {"$set": {
                "owner_email": user["email"],
                "plan": plan,
                "status": "active",
                "paystack_reference": reference,
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return {"status": "success", "plan": plan}
    
    return {"status": "failed"}

@api_router.post("/subscription/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    await db.subscriptions.update_one(
        {"owner_email": user["email"]},
        {"$set": {
            "plan": "basic",
            "status": "cancelled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"status": "cancelled"}

@api_router.post("/subscription/webhook")
async def paystack_webhook(request: Request):
    signature = request.headers.get("x-paystack-signature")
    body = await request.body()
    
    # Verify signature
    computed_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    ).hexdigest()
    
    if not hmac.compare_digest(computed_signature, signature or ""):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    event = await request.json()
    
    if event.get("event") == "charge.success":
        data = event["data"]
        email = data["customer"]["email"]
        plan = data["metadata"].get("plan", "premium")
        
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=30)
        
        await db.subscriptions.update_one(
            {"owner_email": email},
            {"$set": {
                "owner_email": email,
                "plan": plan,
                "status": "active",
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    return {"status": "ok"}

# ===================== FAMILY DASHBOARD ENDPOINTS =====================

@api_router.get("/family/members")
async def get_family_members(user: dict = Depends(get_current_user)):
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not subscription or subscription.get("plan") != "family":
        raise HTTPException(status_code=403, detail="Family plan required")
    
    member_emails = subscription.get("family_members", []) + [user["email"]]
    
    members = []
    for email in member_emails:
        profile = await db.emergency_profiles.find_one({"owner_email": email}, {"_id": 0})
        location = await db.user_locations.find_one({"owner_email": email}, {"_id": 0})
        
        if profile:
            members.append({
                "email": email,
                "full_name": profile.get("full_name", "Unknown"),
                "status": profile.get("status", "safe"),
                "location": location
            })
    
    return members

@api_router.post("/family/members")
async def add_family_member(email: str, user: dict = Depends(get_current_user)):
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not subscription or subscription.get("plan") != "family":
        raise HTTPException(status_code=403, detail="Family plan required")
    
    members = subscription.get("family_members", [])
    if email not in members:
        members.append(email)
        await db.subscriptions.update_one(
            {"owner_email": user["email"]},
            {"$set": {"family_members": members}}
        )
    
    return {"status": "added"}

@api_router.delete("/family/members/{email}")
async def remove_family_member(email: str, user: dict = Depends(get_current_user)):
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not subscription or subscription.get("plan") != "family":
        raise HTTPException(status_code=403, detail="Family plan required")
    
    members = subscription.get("family_members", [])
    if email in members:
        members.remove(email)
        await db.subscriptions.update_one(
            {"owner_email": user["email"]},
            {"$set": {"family_members": members}}
        )
    
    return {"status": "removed"}

@api_router.get("/family/incidents")
async def get_family_incidents(user: dict = Depends(get_current_user)):
    subscription = await db.subscriptions.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not subscription or subscription.get("plan") != "family":
        raise HTTPException(status_code=403, detail="Family plan required")
    
    member_emails = subscription.get("family_members", []) + [user["email"]]
    
    incidents = await db.incidents.find(
        {"owner_email": {"$in": member_emails}, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    
    return incidents

# ===================== CORPORATE ENDPOINTS =====================

@api_router.get("/organization")
async def get_organization(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"admin_email": user["email"]}, {"_id": 0})
    return org

@api_router.post("/organization")
async def create_organization(data: OrganizationCreate, user: dict = Depends(get_current_user)):
    org_id = str(uuid.uuid4())
    org_doc = {
        "id": org_id,
        "admin_email": user["email"],
        "name": data.name,
        "industry": data.industry,
        "address": data.address,
        "employee_count": data.employee_count,
        "max_employees": data.employee_count,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org_doc)
    
    if "_id" in org_doc: del org_doc["_id"]
    return org_doc

@api_router.post("/organization/initialize-payment")
async def initialize_corporate_payment(employee_count: int, callback_url: str, user: dict = Depends(get_current_user)):
    # ₦1,500 per employee per month
    amount = 150000 * employee_count  # in kobo
    reference = f"corp_{uuid.uuid4().hex[:16]}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "email": user["email"],
                "amount": amount,
                "reference": reference,
                "callback_url": callback_url,
                "metadata": {
                    "type": "corporate",
                    "employee_count": employee_count
                }
            }
        )
        result = response.json()
    
    if result.get("status"):
        return {
            "authorization_url": result["data"]["authorization_url"],
            "reference": result["data"]["reference"]
        }
    
    raise HTTPException(status_code=400, detail="Payment initialization failed")

@api_router.get("/organization/employees")
async def get_org_employees(user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"admin_email": user["email"]}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    employees = await db.org_members.find({"org_id": org["id"]}, {"_id": 0}).to_list(1000)
    return employees

@api_router.post("/organization/employees")
async def add_org_employee(email: str, role: str = "employee", user: dict = Depends(get_current_user)):
    org = await db.organizations.find_one({"admin_email": user["email"]}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    member_id = str(uuid.uuid4())
    member_doc = {
        "id": member_id,
        "org_id": org["id"],
        "email": email,
        "role": role,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.org_members.insert_one(member_doc)
    
    if "_id" in member_doc: del member_doc["_id"]
    return member_doc

# ===================== ADMIN ENDPOINTS =====================

@api_router.get("/admin/incidents")
async def get_all_incidents(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    incidents = await db.incidents.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return incidents

@api_router.get("/admin/audit-logs")
async def get_audit_logs(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return logs

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    active_incidents = await db.incidents.count_documents({"status": "active"})
    escalated_incidents = await db.incidents.count_documents({"status": "escalated"})
    resolved_incidents = await db.incidents.count_documents({"status": "resolved"})
    
    return {
        "total_users": total_users,
        "active_incidents": active_incidents,
        "escalated_incidents": escalated_incidents,
        "resolved_incidents": resolved_incidents
    }

@api_router.put("/admin/incidents/{incident_id}")
async def update_incident_status(incident_id: str, status: str, resolution_reason: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_fields = {"status": status}
    if status == "resolved":
        update_fields["resolved_at"] = datetime.now(timezone.utc).isoformat()
        update_fields["resolution_reason"] = resolution_reason or "admin_resolved"
    
    result = await db.incidents.update_one({"id": incident_id}, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {"status": "updated"}

# ===================== UTILITY ENDPOINTS =====================

@api_router.get("/")
async def root():
    return {"message": "TRACEGUARD API v1.0.0", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and configure CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
