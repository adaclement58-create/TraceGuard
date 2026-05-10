import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Token storage key
const TOKEN_KEY = 'tg_token';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Helper to safely get token
const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

// Helper to safely store token
const storeToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (error) {
    console.error('[Auth] Token storage error:', error);
  }
};

// Helper to safely remove token
const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('[Auth] Token removal error:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const watchIdRef = useRef(null);

  // Create axios instance with useMemo
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API,
    });

    instance.interceptors.request.use((config) => {
      const currentToken = getStoredToken();
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    return instance;
  }, []);

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        });
      },
      (error) => {
        console.error('[Auth] Location error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Update user location in backend
  const updateUserLocationInBackend = useCallback(async () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.put('/location/update', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        } catch (error) {
          console.error('[Auth] Failed to update location:', error);
        }
      },
      (error) => {
        console.error('[Auth] Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [api]);

  // Fetch user data
  const fetchUser = useCallback(async () => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setUser(response.data);
      getUserLocation();
      updateUserLocationInBackend();
    } catch (error) {
      console.error('[Auth] Failed to fetch user:', error);
      removeToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [getUserLocation, updateUserLocationInBackend]);

  // Handle Google OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      
      const oauthToken = urlParams.get('token') || 
                          urlParams.get('access_token') || 
                          hashParams.get('token') ||
                          hashParams.get('access_token');
      
      if (oauthToken) {
        console.log('[Auth] OAuth token received, exchanging with backend...');
        
        try {
          const response = await axios.post(`${API}/auth/google`, {
            token: oauthToken
          });
          
          const { access_token, user: userData } = response.data;
          console.log('[Auth] Token exchanged successfully');
          
          storeToken(access_token);
          setToken(access_token);
          setUser(userData);
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('[Auth] OAuth token exchange failed:', error);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };
    
    handleOAuthCallback();
  }, []);

  // Fetch user on mount or token change
  useEffect(() => {
    fetchUser();
  }, [fetchUser, token]);

  // Watch location changes when user is logged in
  useEffect(() => {
    if (!user || !navigator.geolocation) return;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
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
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);

  // Login function
  const login = useCallback(async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    storeToken(access_token);
    setToken(access_token);
    setUser(userData);
    getUserLocation();
    return userData;
  }, [getUserLocation]);

  // Register function
  const register = useCallback(async (email, password, full_name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, full_name });
    const { access_token, user: userData } = response.data;
    storeToken(access_token);
    setToken(access_token);
    setUser(userData);
    getUserLocation();
    return userData;
  }, [getUserLocation]);

  // Logout function
  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
    setUserLocation(null);
  }, []);

  // Update user function
  const updateUser = useCallback((userData) => {
    setUser(prev => prev ? { ...prev, ...userData } : userData);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ 
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
  }), [user, token, loading, userLocation, login, register, logout, updateUser, api, getUserLocation]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
