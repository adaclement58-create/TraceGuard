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
    } catch (error) {
      localStorage.removeItem('tg_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('tg_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (email, password, full_name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, full_name });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('tg_token', access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('tg_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, api }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
