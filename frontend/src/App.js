import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'sonner';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import TrustedCircle from './pages/TrustedCircle';
import TripMonitor from './pages/TripMonitor';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import EvidenceVault from './pages/EvidenceVault';
import SafeZones from './pages/SafeZones';
import Subscription from './pages/Subscription';
import FamilyDashboard from './pages/FamilyDashboard';
import CorporateDashboard from './pages/CorporateDashboard';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';

// Layout
import Layout from './components/Layout';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route wrapper (redirect if logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="spinner" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trusted"
        element={
          <ProtectedRoute>
            <TrustedCircle />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <TripMonitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incidents"
        element={
          <ProtectedRoute>
            <Incidents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incidents/:id"
        element={
          <ProtectedRoute>
            <IncidentDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/evidence"
        element={
          <ProtectedRoute>
            <EvidenceVault />
          </ProtectedRoute>
        }
      />
      <Route
        path="/safe-zones"
        element={
          <ProtectedRoute>
            <SafeZones />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      />
      <Route
        path="/family"
        element={
          <ProtectedRoute>
            <FamilyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/corporate"
        element={
          <ProtectedRoute>
            <CorporateDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="dark">
          <AppRoutes />
          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#f8fafc'
              }
            }}
          />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
