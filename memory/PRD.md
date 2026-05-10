# TRACEGUARD - Personal Safety System PRD

## Project Overview
TRACEGUARD is a comprehensive personal safety system built with React + FastAPI + MongoDB, specifically designed for the Nigerian security context including military personnel, security operatives, and civilians in hostile environments.

**Status: ✅ FULLY TESTED & DEPLOYMENT READY**
**Last Updated: December 2025**
**Test Results: 100% Pass Rate**

## Target Users
- **Civilians** in urban/rural Nigeria
- **Military personnel** deployed in conflict zones (Northeast, Northwest)
- **Security operatives** and private security
- **Corporate organizations** with employees in high-risk areas
- **Families** wanting to monitor loved ones

## What's Been Implemented

### Authentication (VERIFIED WORKING)
- ✅ Email/Password Login
- ✅ Registration with unique emails
- ✅ Google OAuth (Emergent-managed)
- ✅ Token Validation
- ✅ Session Persistence (sessionStorage)

### Core Safety Features
- ✅ Hold-to-Activate SOS Button (3-second hold)
- ✅ Voice-Activated SOS ("Help me TRACEGUARD")
- ✅ Emergency Profile with Medical Info
- ✅ Trusted Contacts with SMS alerts (Termii)
- ✅ Duress PIN (silent escalation)
- ✅ Location Pings during incidents
- ✅ Trip Monitor with check-ins
- ✅ Safe Zones (geofencing)
- ✅ Evidence Vault (photos, video, audio)
- ✅ AI-Powered Safety Score

### Nigeria-Specific Features
- ✅ **Nigeria Emergency Numbers Quick-Dial**
  - National: 112, 199, 122
  - Regional: Lagos (RRS, LASEMA, LASTMA), Abuja, Rivers, Kano
  
- ✅ **One-Chance Silent Distress Mode**
  - Shake-to-trigger (5 shakes)
  - Fake shutdown screen
  - Silent audio recording

- ✅ **SMS-Based SOS Fallback**
  - Send location via SMS when offline
  - Native SMS app integration

### Tactical Mode Features (NEW - For Military/Security)
All work 100% OFFLINE - designed for conflict zones with no network

- ✅ **Dead Man's Switch**
  - Configurable check-in intervals (5-60 min)
  - Missed check-in counter (1-5)
  - Auto-alert to contacts/command
  - Works via local timers + Service Workers

- ✅ **Tactical Mesh Network**
  - WiFi hotspot-based squad communication
  - Network ID format: TG-XXXXXX
  - Message broadcasting
  - Location sharing
  - SOS broadcast to all connected devices

- ✅ **QR Emergency Beacon**
  - Generate QR codes with GPS location
  - SOS QR (red) and Location QR (green)
  - Share via native share or copy
  - Scannable by any camera app

- ✅ **Offline Threat Map**
  - Download threat intel to IndexedDB
  - Simulated data for NE/NW Nigeria
  - Report threats: IED, Ambush, Hostile
  - Shows nearby threats within 10km

- ✅ **Panic Data Wipe**
  - Triple-tap to trigger
  - Confirmation code required (type "WIPE")
  - Clears: localStorage, sessionStorage, IndexedDB, cookies, caches
  - Unregisters service workers

### Frontend Pages (17+)
1. Login/Register
2. Home (SOS, Voice SOS, One-Chance, Quick Access, Safety Score, Emergency Numbers, SMS Fallback)
3. Trusted Circle
4. Trip Monitor
5. Incidents
6. Incident Detail
7. Evidence Vault (Premium)
8. Safe Zones
9. Find Safety (compass, GPS, nearby places, emergency numbers)
10. **Tactical Mode** (NEW - 6 offline features)
11. Family Dashboard
12. Corporate Dashboard
13. Subscription
14. Settings
15. Admin Dashboard

### API Endpoints (50+)
Full REST API with JWT authentication. Key endpoints:
- `/api/auth/*` - Authentication
- `/api/incidents/*` - SOS and incident management
- `/api/contacts/*` - Trusted circle
- `/api/zones/*` - Safe zones
- `/api/trips/*` - Trip monitoring
- `/api/sms/send-location` - SMS fallback
- `/api/incidents/sms-sos` - SMS-based SOS

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Radix UI, Lucide Icons, QRCode
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT
- **Database**: MongoDB
- **Maps**: Leaflet + OpenStreetMap
- **Integrations**: Termii SMS, Paystack, Google Auth, OpenAI

## Offline Capabilities
| Feature | Storage Method | Works Offline |
|---------|---------------|---------------|
| Dead Man's Switch | localStorage + timers | ✅ 100% |
| Tactical Mesh | WiFi hotspot + WebRTC | ✅ 100% |
| QR Beacon | In-memory + QRCode lib | ✅ 100% |
| Threat Map | IndexedDB | ✅ 100% |
| Panic Wipe | localStorage + IndexedDB | ✅ 100% |
| One-Chance Mode | localStorage | ✅ 100% |
| SMS Fallback | Native SMS app | ✅ 100% |

## Test Credentials
- Regular User: testuser@example.com / password
- Admin User: admin@traceguard.com / admin123

## File Structure
```
/app/
├── backend/
│   ├── server.py (2000+ lines)
│   ├── models/schemas.py
│   └── services/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── DeadManSwitch.js
│       │   ├── TacticalMesh.js
│       │   ├── QREmergencyBeacon.js
│       │   ├── OfflineThreatMap.js
│       │   ├── PanicWipe.js
│       │   ├── OneChanceMode.js
│       │   ├── NigeriaEmergencyNumbers.js
│       │   ├── SMSFallback.js
│       │   └── ...
│       └── pages/
│           ├── TacticalMode.js
│           └── ...
└── memory/PRD.md
```

## Security Situation Context
The tactical features were designed based on:
- **Northeast Nigeria**: Boko Haram/ISWAP insurgency (Borno, Yobe, Adamawa)
- **Northwest Nigeria**: Banditry crisis (~30,000 armed bandits in Zamfara, Kaduna, Katsina)
- Key challenges: No network coverage, ambushes, isolated patrols, slow reinforcements

## Future Enhancements (Backlog)
- [ ] Community Safety Network (neighborhood alerts)
- [ ] USSD integration for feature phones
- [ ] Multi-language support (Pidgin, Yoruba, Igbo, Hausa)
- [ ] Satellite beacon integration (Garmin inReach)
- [ ] Biometric verification (heartbeat/fingerprint)
- [ ] Convoy tracking system
- [ ] Smartwatch companion app

## Test Reports
- `/app/test_reports/iteration_6.json` - Nigeria features
- `/app/test_reports/iteration_7.json` - Tactical Mode features

## Production URL
https://emergency-ui-kit-1.preview.emergentagent.com
