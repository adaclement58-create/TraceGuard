"""
TRACEGUARD Backend API Tests
Tests authentication flows and main API endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from previous iterations
TEST_USER = {"email": "testuser@example.com", "password": "password"}
NEW_USER = {"email": f"newtestuser_{uuid.uuid4().hex[:8]}@example.com", "password": "newtest123", "name": "New Test User"}


class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_api_reachable(self):
        """Test that API is reachable"""
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        # Should return 401 without auth, not 500 or connection error
        assert response.status_code in [401, 200], f"API not reachable: {response.status_code}"
        print(f"✓ API reachable, status: {response.status_code}")


class TestAuthLogin:
    """Login authentication tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_USER["email"]
        print(f"✓ Login successful for {TEST_USER['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }, timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com"
        }, timeout=10)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Missing fields correctly rejected")


class TestAuthRegister:
    """Registration tests"""
    
    def test_register_new_user(self):
        """Test registration of new user"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": NEW_USER["email"],
            "password": NEW_USER["password"],
            "full_name": NEW_USER["name"]
        }, timeout=10)
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == NEW_USER["email"]
        assert data["user"]["full_name"] == NEW_USER["name"]
        print(f"✓ Registration successful for {NEW_USER['email']}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER["email"],
            "password": "somepassword",
            "full_name": "Duplicate User"
        }, timeout=10)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Duplicate email correctly rejected")


class TestAuthMe:
    """Auth/me endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_get_me_authenticated(self, auth_token):
        """Test getting current user with valid token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", 
                               headers={"Authorization": f"Bearer {auth_token}"}, timeout=10)
        assert response.status_code == 200, f"Get me failed: {response.text}"
        
        data = response.json()
        assert data["email"] == TEST_USER["email"]
        print(f"✓ Get me successful: {data['email']}")
    
    def test_get_me_unauthenticated(self):
        """Test getting current user without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_get_me_invalid_token(self):
        """Test getting current user with invalid token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", 
                               headers={"Authorization": "Bearer invalid_token"}, timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid token correctly rejected")


class TestGoogleAuth:
    """Google OAuth endpoint tests"""
    
    def test_google_auth_endpoint_exists(self):
        """Test that Google auth endpoint exists"""
        # Send a dummy token - should fail with 400, not 404
        response = requests.post(f"{BASE_URL}/api/auth/google", json={
            "token": "dummy_token"
        }, timeout=10)
        # Should be 400 (invalid token) not 404 (endpoint not found)
        assert response.status_code in [400, 200], f"Google auth endpoint issue: {response.status_code}"
        print(f"✓ Google auth endpoint exists, status: {response.status_code}")


class TestProtectedEndpoints:
    """Tests for protected API endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_get_profile(self, auth_headers):
        """Test getting user profile"""
        response = requests.get(f"{BASE_URL}/api/profile", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get profile failed: {response.text}"
        print("✓ Get profile successful")
    
    def test_get_contacts(self, auth_headers):
        """Test getting trusted contacts"""
        response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get contacts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Contacts should be a list"
        print(f"✓ Get contacts successful: {len(data)} contacts")
    
    def test_get_incidents(self, auth_headers):
        """Test getting incidents"""
        response = requests.get(f"{BASE_URL}/api/incidents", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get incidents failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Incidents should be a list"
        print(f"✓ Get incidents successful: {len(data)} incidents")
    
    def test_get_safe_zones(self, auth_headers):
        """Test getting safe zones"""
        response = requests.get(f"{BASE_URL}/api/safe-zones", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get safe zones failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Safe zones should be a list"
        print(f"✓ Get safe zones successful: {len(data)} zones")
    
    def test_get_trips(self, auth_headers):
        """Test getting trips"""
        response = requests.get(f"{BASE_URL}/api/trips", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get trips failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Trips should be a list"
        print(f"✓ Get trips successful: {len(data)} trips")
    
    def test_get_subscription(self, auth_headers):
        """Test getting subscription"""
        response = requests.get(f"{BASE_URL}/api/subscription", headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Get subscription failed: {response.text}"
        data = response.json()
        assert "plan" in data, "Subscription should have plan"
        print(f"✓ Get subscription successful: {data.get('plan', 'basic')}")


class TestContactsCRUD:
    """CRUD tests for trusted contacts"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_create_and_delete_contact(self, auth_headers):
        """Test creating and deleting a contact"""
        # Create contact
        contact_data = {
            "name": f"TEST_Contact_{uuid.uuid4().hex[:6]}",
            "phone": "+2348012345678",
            "email": "testcontact@example.com",
            "role": "contact",
            "relationship": "friend",
            "notification_preference": "both"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/contacts", 
                                        json=contact_data, headers=auth_headers, timeout=10)
        # May fail if contact limit reached (basic plan = 3)
        if create_response.status_code == 403:
            print("✓ Contact limit reached (expected for basic plan)")
            return
        
        assert create_response.status_code == 200, f"Create contact failed: {create_response.text}"
        created = create_response.json()
        assert created["name"] == contact_data["name"]
        contact_id = created["id"]
        print(f"✓ Contact created: {contact_id}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers, timeout=10)
        assert get_response.status_code == 200
        contacts = get_response.json()
        assert any(c["id"] == contact_id for c in contacts), "Created contact not found in list"
        print("✓ Contact verified in list")
        
        # Delete contact
        delete_response = requests.delete(f"{BASE_URL}/api/contacts/{contact_id}", 
                                          headers=auth_headers, timeout=10)
        assert delete_response.status_code == 200, f"Delete contact failed: {delete_response.text}"
        print("✓ Contact deleted")
        
        # Verify deletion
        get_response2 = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers, timeout=10)
        contacts2 = get_response2.json()
        assert not any(c["id"] == contact_id for c in contacts2), "Deleted contact still in list"
        print("✓ Contact deletion verified")


class TestTripsCRUD:
    """CRUD tests for trips"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_create_trip(self, auth_headers):
        """Test creating a trip"""
        from datetime import datetime, timedelta
        
        eta = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        trip_data = {
            "destination": "TEST_Destination",
            "eta": eta,
            "notes": "Test trip",
            "check_in_interval_minutes": 30,
            "max_missed_before_escalation": 3
        }
        
        response = requests.post(f"{BASE_URL}/api/trips", 
                                json=trip_data, headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Create trip failed: {response.text}"
        
        data = response.json()
        assert data["destination"] == trip_data["destination"]
        assert data["status"] == "active"
        print(f"✓ Trip created: {data['id']}")
        
        # Cancel the trip to clean up
        cancel_response = requests.post(f"{BASE_URL}/api/trips/{data['id']}/cancel", 
                                        headers=auth_headers, timeout=10)
        assert cancel_response.status_code == 200
        print("✓ Trip cancelled (cleanup)")


class TestSafeZonesCRUD:
    """CRUD tests for safe zones"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_create_and_delete_safe_zone(self, auth_headers):
        """Test creating and deleting a safe zone"""
        zone_data = {
            "name": f"TEST_Zone_{uuid.uuid4().hex[:6]}",
            "zone_type": "home",
            "latitude": 6.5244,
            "longitude": 3.3792,
            "radius": 200,
            "notify_on_enter": True,
            "notify_on_exit": True
        }
        
        # Create zone
        create_response = requests.post(f"{BASE_URL}/api/safe-zones", 
                                        json=zone_data, headers=auth_headers, timeout=10)
        assert create_response.status_code == 200, f"Create zone failed: {create_response.text}"
        
        created = create_response.json()
        assert created["name"] == zone_data["name"]
        zone_id = created["id"]
        print(f"✓ Safe zone created: {zone_id}")
        
        # Delete zone
        delete_response = requests.delete(f"{BASE_URL}/api/safe-zones/{zone_id}", 
                                          headers=auth_headers, timeout=10)
        assert delete_response.status_code == 200, f"Delete zone failed: {delete_response.text}"
        print("✓ Safe zone deleted")


class TestLocationEndpoints:
    """Tests for location-related endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER, timeout=10)
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not get auth token")
    
    def test_update_location(self, auth_headers):
        """Test updating user location"""
        location_data = {
            "latitude": 6.5244,
            "longitude": 3.3792,
            "accuracy": 10.0,
            "battery": 85,
            "network": "wifi"
        }
        
        response = requests.put(f"{BASE_URL}/api/location/update", 
                               json=location_data, headers=auth_headers, timeout=10)
        assert response.status_code == 200, f"Update location failed: {response.text}"
        print("✓ Location updated successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
