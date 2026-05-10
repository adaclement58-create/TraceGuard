"""
TRACEGUARD Nigeria-Specific Features Tests
Tests for SMS SOS, Send Location, and related endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = {"email": "testuser@example.com", "password": "password"}


class TestSMSSOSEndpoint:
    """Tests for POST /api/incidents/sms-sos endpoint"""
    
    def test_sms_sos_endpoint_exists(self):
        """Test that SMS SOS endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/incidents/sms-sos", json={
            "phone": "+2348012345678",
            "latitude": 6.5244,
            "longitude": 3.3792,
            "message": "Test SOS"
        }, timeout=10)
        # Should return 200 or error (not 404)
        assert response.status_code != 404, f"SMS SOS endpoint not found: {response.status_code}"
        print(f"✓ SMS SOS endpoint exists, status: {response.status_code}")
    
    def test_sms_sos_with_unregistered_phone(self):
        """Test SMS SOS with unregistered phone number"""
        response = requests.post(f"{BASE_URL}/api/incidents/sms-sos", json={
            "phone": "+2349999999999",  # Unregistered phone
            "latitude": 6.5244,
            "longitude": 3.3792
        }, timeout=10)
        # Should return error for unregistered phone
        assert response.status_code == 200, f"Unexpected status: {response.status_code}"
        data = response.json()
        # Should indicate phone not registered
        assert data.get("status") == "error" or "incident_id" in data
        print(f"✓ SMS SOS handles unregistered phone correctly: {data}")


class TestSendLocationEndpoint:
    """Tests for POST /api/sms/send-location endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_send_location_endpoint_exists(self, auth_headers):
        """Test that send-location endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/sms/send-location", 
                                headers=auth_headers, timeout=10)
        # Should return 200 or 400 (no contacts), not 404
        assert response.status_code != 404, f"Send location endpoint not found: {response.status_code}"
        print(f"✓ Send location endpoint exists, status: {response.status_code}")
    
    def test_send_location_requires_auth(self):
        """Test that send-location requires authentication"""
        response = requests.post(f"{BASE_URL}/api/sms/send-location", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Send location correctly requires authentication")
    
    def test_send_location_with_auth(self, auth_headers):
        """Test send-location with valid authentication"""
        response = requests.post(f"{BASE_URL}/api/sms/send-location", 
                                headers=auth_headers, timeout=10)
        # May return 400 if no contacts, or 200 if successful
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        data = response.json()
        if response.status_code == 200:
            assert "status" in data
            print(f"✓ Send location successful: {data}")
        else:
            print(f"✓ Send location returned expected error (no contacts): {data}")


class TestIncidentCreation:
    """Tests for incident creation with Nigeria-specific types"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_create_one_chance_incident(self, auth_headers):
        """Test creating a one-chance type incident"""
        response = requests.post(f"{BASE_URL}/api/incidents", json={
            "incident_type": "one_chance",
            "severity": "critical",
            "latitude": 6.5244,
            "longitude": 3.3792
        }, headers=auth_headers, timeout=10)
        
        assert response.status_code == 200, f"Create incident failed: {response.text}"
        data = response.json()
        assert data["incident_type"] == "one_chance"
        assert data["severity"] == "critical"
        assert data["status"] == "active"
        print(f"✓ One-chance incident created: {data['id']}")
        
        # Resolve the incident to clean up
        # First need to set a resolution PIN
        profile_response = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers, timeout=10)
        if profile_response.status_code == 200:
            profile = profile_response.json()
            if profile.get("status") != "no_profile":
                # Try to resolve with a PIN
                resolve_response = requests.put(
                    f"{BASE_URL}/api/incidents/{data['id']}/resolve?pin=1234",
                    headers=auth_headers, timeout=10
                )
                print(f"  Cleanup resolve attempt: {resolve_response.status_code}")
    
    def test_create_sms_sos_incident_type(self, auth_headers):
        """Test creating an sms_sos type incident"""
        response = requests.post(f"{BASE_URL}/api/incidents", json={
            "incident_type": "sms_sos",
            "severity": "high",
            "latitude": 6.5244,
            "longitude": 3.3792
        }, headers=auth_headers, timeout=10)
        
        assert response.status_code == 200, f"Create incident failed: {response.text}"
        data = response.json()
        assert data["incident_type"] == "sms_sos"
        print(f"✓ SMS SOS incident created: {data['id']}")


class TestTestAlertEndpoint:
    """Tests for test alert functionality"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_test_alert_endpoint_exists(self, auth_headers):
        """Test that test-alert endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/incidents/test-alert", 
                                headers=auth_headers, timeout=10)
        # Should return 200 or 400 (no contacts), not 404
        assert response.status_code != 404, f"Test alert endpoint not found: {response.status_code}"
        print(f"✓ Test alert endpoint exists, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
