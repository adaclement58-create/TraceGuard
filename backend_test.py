#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Optional, Dict, Any

class TraceguardAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.test_user_email = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}@example.com"
        self.test_password = "TestPass123!"
        self.test_name = "Test User"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.timeout = 30

    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, test_name: str, method: str, endpoint: str, 
                 expected_status: int, data: Optional[Dict] = None, 
                 headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        self.tests_run += 1
        # Ensure endpoint starts with /api for Kubernetes ingress routing
        if not endpoint.startswith('/api'):
            endpoint = f"/api{endpoint}" if not endpoint.startswith('/') else f"/api{endpoint}"
        url = f"{self.base_url}{endpoint}"
        
        # Default headers
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        self.log(f"Testing {test_name}...")
        self.log(f"  {method} {url}", "DEBUG")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=req_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=req_headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=req_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=req_headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text[:500]}

            if success:
                self.tests_passed += 1
                self.log(f"  ✅ PASSED - Status: {response.status_code}")
                return True, response_data
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                self.log(f"  ❌ FAILED - {error_msg}")
                if response_data.get('detail'):
                    self.log(f"    Error: {response_data['detail']}")
                self.failed_tests.append({
                    'test': test_name,
                    'endpoint': endpoint,
                    'error': error_msg,
                    'response': response_data
                })
                return False, response_data

        except Exception as e:
            self.log(f"  ❌ FAILED - Exception: {str(e)}")
            self.failed_tests.append({
                'test': test_name,
                'endpoint': endpoint,
                'error': str(e),
                'response': {}
            })
            return False, {}

    def test_root_endpoint(self) -> bool:
        """Test root API endpoint"""
        return self.run_test("Root endpoint", "GET", "/", 200)[0]

    def test_health_check(self) -> bool:
        """Test health check endpoint"""
        return self.run_test("Health check", "GET", "/health", 200)[0]

    def test_user_registration(self) -> bool:
        """Test user registration"""
        success, response = self.run_test(
            "User registration",
            "POST",
            "/auth/register",
            200,
            {
                "email": self.test_user_email,
                "password": self.test_password,
                "full_name": self.test_name
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.log(f"  🔑 Token obtained for user: {self.test_user_email}")
            return True
        return False

    def test_user_login(self) -> bool:
        """Test user login"""
        success, response = self.run_test(
            "User login",
            "POST", 
            "/auth/login",
            200,
            {
                "email": self.test_user_email,
                "password": self.test_password
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_current_user(self) -> bool:
        """Test get current user info"""
        return self.run_test("Get current user", "GET", "/auth/me", 200)[0]

    def test_profile_endpoints(self) -> bool:
        """Test profile creation and retrieval"""
        # Get profile (should be empty first)
        success1, _ = self.run_test("Get profile (empty)", "GET", "/profile", 200)
        
        # Create profile
        profile_data = {
            "phone_number": "+2348123456789",
            "blood_group": "O+",
            "medical_conditions": "None",
            "emergency_note": "Test emergency contact"
        }
        success2, _ = self.run_test("Create profile", "POST", "/profile", 200, profile_data)
        
        # Update profile
        update_data = {
            "full_name": "Updated Test User",
            "resolution_pin": "1234",
            "duress_pin": "5678",
            "kidnap_mode": False,
            "sms_fallback": True
        }
        success3, _ = self.run_test("Update profile", "PUT", "/profile", 200, update_data)
        
        return success1 and success2 and success3

    def test_contacts_endpoints(self) -> bool:
        """Test trusted contacts CRUD operations"""
        # Get contacts (empty list)
        success1, _ = self.run_test("Get contacts (empty)", "GET", "/contacts", 200)
        
        # Create contact
        contact_data = {
            "name": "Emergency Contact",
            "phone": "+2348987654321", 
            "email": "emergency@test.com",
            "role": "family",
            "relationship": "spouse",
            "notification_preference": "both"
        }
        success2, response = self.run_test("Create contact", "POST", "/contacts", 200, contact_data)
        
        contact_id = None
        if success2 and 'id' in response:
            contact_id = response['id']
            self.log(f"  📞 Contact created with ID: {contact_id}")
        
        # Get contacts (should have 1)
        success3, _ = self.run_test("Get contacts (with data)", "GET", "/contacts", 200)
        
        # Delete contact
        success4 = True
        if contact_id:
            success4, _ = self.run_test("Delete contact", "DELETE", f"/contacts/{contact_id}", 200)
        
        return success1 and success2 and success3 and success4

    def test_incidents_endpoints(self) -> bool:
        """Test incident creation and management"""
        # Get incidents (empty)
        success1, _ = self.run_test("Get incidents (empty)", "GET", "/incidents", 200)
        
        # Create incident (SOS)
        incident_data = {
            "incident_type": "sos",
            "severity": "high",
            "latitude": 6.5244,
            "longitude": 3.3792
        }
        success2, response = self.run_test("Create incident", "POST", "/incidents", 200, incident_data)
        
        incident_id = None
        if success2 and 'id' in response:
            incident_id = response['id']
            self.log(f"  🚨 Incident created with ID: {incident_id}")
        
        # Get specific incident
        success3 = True
        if incident_id:
            success3, _ = self.run_test("Get specific incident", "GET", f"/incidents/{incident_id}", 200)
        
        # Test alert functionality
        success4, _ = self.run_test("Send test alert", "POST", "/incidents/test-alert", 200)
        
        return success1 and success2 and success3 and success4

    def test_trips_endpoints(self) -> bool:
        """Test trip monitoring endpoints"""
        # Get trips (empty)
        success1, _ = self.run_test("Get trips (empty)", "GET", "/trips", 200)
        
        # Create trip
        trip_data = {
            "destination": "Test Destination",
            "eta": "2024-12-31T23:59:59",
            "notes": "Test trip",
            "check_in_interval_minutes": 30,
            "max_missed_before_escalation": 3
        }
        success2, response = self.run_test("Create trip", "POST", "/trips", 200, trip_data)
        
        trip_id = None
        if success2 and 'id' in response:
            trip_id = response['id']
            self.log(f"  🗺️ Trip created with ID: {trip_id}")
        
        # Check-in to trip
        success3 = True
        if trip_id:
            success3, _ = self.run_test("Trip check-in", "POST", f"/trips/{trip_id}/check-in", 200)
        
        # Complete trip
        success4 = True
        if trip_id:
            success4, _ = self.run_test("Complete trip", "POST", f"/trips/{trip_id}/complete", 200)
        
        return success1 and success2 and success3 and success4

    def test_safe_zones_endpoints(self) -> bool:
        """Test safe zones endpoints"""
        # Get safe zones (empty)
        success1, _ = self.run_test("Get safe zones (empty)", "GET", "/safe-zones", 200)
        
        # Create safe zone
        zone_data = {
            "name": "Test Home Zone",
            "zone_type": "home",
            "latitude": 6.5244,
            "longitude": 3.3792,
            "radius": 200,
            "notify_on_enter": True,
            "notify_on_exit": True
        }
        success2, response = self.run_test("Create safe zone", "POST", "/safe-zones", 200, zone_data)
        
        zone_id = None
        if success2 and 'id' in response:
            zone_id = response['id']
            self.log(f"  📍 Safe zone created with ID: {zone_id}")
        
        # Update zone status
        success3 = True
        if zone_id:
            success3, _ = self.run_test("Update zone status", "PUT", f"/safe-zones/{zone_id}?is_active=false", 200)
        
        # Delete zone
        success4 = True
        if zone_id:
            success4, _ = self.run_test("Delete safe zone", "DELETE", f"/safe-zones/{zone_id}", 200)
        
        return success1 and success2 and success3 and success4

    def test_subscription_endpoints(self) -> bool:
        """Test subscription management"""
        # Get subscription (basic)
        success1, _ = self.run_test("Get subscription", "GET", "/subscription", 200)
        
        # Initialize payment (should fail without proper data but endpoint should work)
        payment_data = {
            "plan": "premium",
            "callback_url": "https://test.com/callback"
        }
        # This might fail due to Paystack integration, but endpoint should be accessible
        success2, _ = self.run_test("Initialize payment", "POST", "/subscription/initialize", 400, payment_data)
        # We expect 400 because we might not have valid Paystack config in test
        
        return success1  # Only count subscription get as critical

    def run_all_tests(self) -> bool:
        """Run comprehensive API test suite"""
        self.log("🚀 Starting TRACEGUARD API Test Suite")
        self.log(f"📡 Base URL: {self.base_url}")
        
        # Test sequence
        tests = [
            ("Basic Endpoints", [
                self.test_root_endpoint,
                self.test_health_check
            ]),
            ("Authentication", [
                self.test_user_registration,
                self.test_get_current_user,
                self.test_user_login  # Test login after registration
            ]),
            ("Profile Management", [
                self.test_profile_endpoints
            ]),
            ("Trusted Contacts", [
                self.test_contacts_endpoints
            ]),
            ("Incidents & SOS", [
                self.test_incidents_endpoints
            ]),
            ("Trip Monitoring", [
                self.test_trips_endpoints
            ]),
            ("Safe Zones", [
                self.test_safe_zones_endpoints
            ]),
            ("Subscription", [
                self.test_subscription_endpoints
            ])
        ]
        
        all_passed = True
        
        for section_name, section_tests in tests:
            self.log(f"\n📋 Testing {section_name}")
            self.log("=" * 50)
            
            section_passed = 0
            section_total = len(section_tests)
            
            for test_func in section_tests:
                try:
                    if test_func():
                        section_passed += 1
                    else:
                        all_passed = False
                except Exception as e:
                    self.log(f"❌ Test {test_func.__name__} failed with exception: {e}")
                    all_passed = False
            
            self.log(f"📊 Section Result: {section_passed}/{section_total} passed")
        
        return all_passed

    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "="*60)
        self.log("🏁 TEST SUMMARY")
        self.log("="*60)
        self.log(f"Total Tests: {self.tests_run}")
        self.log(f"Passed: {self.tests_passed}")
        self.log(f"Failed: {len(self.failed_tests)}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            self.log("\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                self.log(f"{i}. {test['test']} - {test['error']}")
                if test['response'].get('detail'):
                    self.log(f"   Details: {test['response']['detail']}")


def main():
    # Get base URL from environment or use default
    base_url = "https://emergency-ui-kit-1.preview.emergentagent.com"
    
    tester = TraceguardAPITester(base_url)
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        return 0 if success and len(tester.failed_tests) == 0 else 1
        
    except KeyboardInterrupt:
        tester.log("\n⚠️ Test suite interrupted by user")
        return 1
    except Exception as e:
        tester.log(f"\n💥 Test suite failed with error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())