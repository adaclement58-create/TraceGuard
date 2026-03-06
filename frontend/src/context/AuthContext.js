import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tg_token'));
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  const api = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  api.interceptors.request.use((config) => {
    const currentToken = localStorage.getItem('tg_token');
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  });

  // Handle Google OAuth callback - check for token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleToken = urlParams.get('token');
    
    if (googleToken) {
      console.log('[Auth] Google OAuth token received');
      localStorage.setItem('tg_token', googleToken);
      setToken(googleToken);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const storedToken = localStorage.getItem('tg_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setUser(response.data);
      
      // Get user location after successful auth
      getUserLocation();
      
      // Update location in backend
      updateUserLocationInBackend(response.data.email);
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error);
      localStorage.removeItem('tg_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
          };
          setUserLocation(location);
          console.log('[Auth] User location obtained:', location);
        },
        (error) => {
          console.error('[Auth] Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Update user location in backend
  const updateUserLocationInBackend = useCallback(async (email) => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const storedToken = localStorage.getItem('tg_token');
          await axios.put(`${API}/location/update`, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          }, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          console.log('[Auth] Location updated in backend');
        } catch (error) {
          console.error('[Auth] Failed to update location:', error);
        }
      },
      (error) => {
        console.error('[Auth] Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser, token]);

  // Watch location changes
  useEffect(() => {
    if (!user) return;
    
    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        });
      },
      (error) => console.error('[Auth] Watch location error:', error),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('tg_token', access_token);
    setToken(access_token);
    setUser(userData);
    getUserLocation();
    return userData;
  };

  const register = async (email, password, full_name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, full_name });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('tg_token', access_token);
    setToken(access_token);
    setUser(userData);
    getUserLocation();
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('tg_token');
    setToken(null);
    setUser(null);
    setUserLocation(null);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      userLocation,
      login, 
      register, 
      logout, 
      updateUser, 
      api,
      getUserLocation 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
