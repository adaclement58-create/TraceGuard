# Backend Models - Pydantic schemas for TRACEGUARD
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# ===================== AUTH MODELS =====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# ===================== PROFILE MODELS =====================

class EmergencyProfileCreate(BaseModel):
    phone_number: str
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

# ===================== CONTACT MODELS =====================

class TrustedContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = "contact"

class TrustedContact(BaseModel):
    id: str
    owner_email: str
    name: str
    phone: str
    email: Optional[str]
    role: str
    created_at: str

# ===================== INCIDENT MODELS =====================

class IncidentCreate(BaseModel):
    incident_type: str = "sos"
    severity: str = "high"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    message: Optional[str] = None

class LocationPing(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

# ===================== TRIP MODELS =====================

class TripCreate(BaseModel):
    destination: str
    eta: str
    notes: Optional[str] = None
    check_in_interval_minutes: int = 30
    max_missed_before_escalation: int = 3

# ===================== SAFE ZONE MODELS =====================

class SafeZoneCreate(BaseModel):
    name: str
    zone_type: str = "home"
    latitude: float
    longitude: float
    radius: float = 200
    notify_on_enter: bool = True
    notify_on_exit: bool = True

# ===================== EVIDENCE MODELS =====================

class EvidenceCreate(BaseModel):
    incident_id: str
    evidence_type: str
    file_url: str
    sha256_hash: str
    duration: Optional[float] = None

# ===================== SUBSCRIPTION MODELS =====================

class SubscriptionInitialize(BaseModel):
    plan: str
    callback_url: str

# ===================== ORGANIZATION MODELS =====================

class OrganizationCreate(BaseModel):
    name: str
    employee_count: int = 10

class OrgEmployeeAdd(BaseModel):
    email: str
    role: str = "employee"

# ===================== PUSH NOTIFICATION MODELS =====================

class PushSubscriptionData(BaseModel):
    subscription: dict

# ===================== FAMILY MODELS =====================

class FamilyMemberAdd(BaseModel):
    member_email: EmailStr
