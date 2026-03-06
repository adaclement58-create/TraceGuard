import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, ShieldAlert, MapPin, Users, CheckCircle2,
  AlertTriangle, Phone, Navigation, Clock, Send, Loader2, Camera
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { EvidenceCapture } from '../components/EvidenceCapture';
import { useLiveLocationTracker, useLocationReporter, useGeofenceMonitor, useOfflineSOS } from '../hooks/useLocationTracking';
import VoiceSOS from '../components/VoiceSOS';
import QuickAccess from '../components/QuickAccess';

const Home = () => {
  const { user, api } = useAuth();
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [zones, setZones] = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sosActive, setSosActive] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolvePin, setResolvePin] = useState('');
  const [resolving, setResolving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showEvidenceCapture, setShowEvidenceCapture] = useState(false);
  
  const holdTimerRef = useRef(null);
  const holdStartRef = useRef(null);

  // Location tracking hooks
  useLiveLocationTracker({
    api,
    incidentId: activeIncident?.id,
    isActive: sosActive,
    intervalMs: 30000
  });

  useLocationReporter({
    api,
    enabled: true,
    intervalMs: 60000
  });

  useGeofenceMonitor({
    api,
    zones: zones.filter(z => z.is_active),
    enabled: true
  });

  const { queueSOS } = useOfflineSOS({ api });

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, contactsRes, incidentsRes, zonesRes] = await Promise.all([
        api.get('/profile').catch(() => ({ data: null })),
        api.get('/contacts').catch(() => ({ data: [] })),
        api.get('/incidents').catch(() => ({ data: [] })),
        api.get('/safe-zones').catch(() => ({ data: [] }))
      ]);

      setProfile(profileRes.data?.status === 'no_profile' ? null : profileRes.data);
      setContacts(contactsRes.data || []);
      setZones(zonesRes.data || []);
      
      const active = incidentsRes.data?.find(i => i.status === 'active');
      setActiveIncident(active);
      setSosActive(!!active);
      if (active) setShowEvidenceCapture(true);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHoldStart = () => {
    if (sosActive) {
      setResolveDialogOpen(true);
      return;
    }

    holdStartRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        activateSOS();
      }
    }, 50);
  };

  const handleHoldEnd = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      setHoldProgress(0);
    }
  };

  const activateSOS = async () => {
    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.log('Location unavailable');
      }

      // Check if offline - queue SOS
      if (!navigator.onLine) {
        queueSOS({
          incident_type: 'sos',
          severity: 'high',
          latitude: lat,
          longitude: lng
        });
        alert('You are offline. SOS has been queued and will be sent when you reconnect.');
        setHoldProgress(0);
        return;
      }

      const response = await api.post('/incidents', {
        incident_type: 'sos',
        severity: 'high',
        latitude: lat,
        longitude: lng
      });

      setActiveIncident(response.data);
      setSosActive(true);
      setHoldProgress(0);
      setShowEvidenceCapture(true); // Auto-show evidence capture
    } catch (error) {
      console.error('SOS activation failed:', error);
      alert('Failed to activate SOS. Please try again.');
    }
  };

  const handleResolve = async () => {
    if (!resolvePin.trim()) return;
    setResolving(true);

    try {
      await api.put(`/incidents/${activeIncident.id}/resolve?pin=${resolvePin}`);
      setSosActive(false);
      setActiveIncident(null);
      setResolveDialogOpen(false);
      setResolvePin('');
      setShowEvidenceCapture(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Invalid PIN');
    } finally {
      setResolving(false);
    }
  };

  const handleEvidenceCapture = async (evidenceItem) => {
    if (!activeIncident) return;
    
    try {
      // In production, upload blob to storage and get URL
      // For now, create a data URL or use object URL
      await api.post('/evidence', {
        incident_id: activeIncident.id,
        evidence_type: evidenceItem.type,
        file_url: evidenceItem.url,
        sha256_hash: evidenceItem.hash,
        duration: evidenceItem.duration
      });
      console.log('Evidence uploaded successfully');
    } catch (error) {
      console.error('Failed to upload evidence:', error);
    }
  };

  const sendTestAlert = async () => {
    if (contacts.length === 0) {
      alert('Please add contacts first');
      return;
    }
    setSendingTest(true);
    try {
      await api.post('/incidents/test-alert');
      alert('Test alert sent successfully!');
    } catch (error) {
      alert('Failed to send test alert');
    } finally {
      setSendingTest(false);
    }
  };

  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  const getStatusDisplay = () => {
    if (sosActive) return { text: 'SOS ACTIVE', color: 'bg-tg-danger', textColor: 'text-white' };
    if (profile?.status === 'trip_active') return { text: 'TRIP IN PROGRESS', color: 'bg-tg-warning', textColor: 'text-black' };
    return { text: 'SAFE', color: 'bg-tg-safe', textColor: 'text-black' };
  };

  const status = getStatusDisplay();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="home-page">
      {/* Status Banner */}
      <div 
        className={`${status.color} ${status.textColor} rounded-2xl p-4 flex items-center justify-between`}
        data-testid="status-banner"
      >
        <div className="flex items-center gap-3">
          {sosActive ? (
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          ) : (
            <ShieldCheck className="w-6 h-6" />
          )}
          <div>
            <p className="font-bold tg-heading tracking-wide">{status.text}</p>
            <p className="text-sm opacity-80">
              {sosActive ? 'Help is on the way' : `Welcome, ${user?.full_name}`}
            </p>
          </div>
        </div>
        {sosActive && (
          <span className="badge badge-danger animate-blink">
            <AlertTriangle className="w-3 h-3" />
            LIVE
          </span>
        )}
      </div>

      {/* Setup Checklist */}
      {!profile && (
        <div className="tg-card p-6 animate-slide-up">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-tg-warning" />
            Complete Your Setup
          </h2>
          <div className="space-y-3">
            <Link
              to="/settings"
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-zinc-300">Create emergency profile</span>
              <CheckCircle2 className="w-5 h-5 text-zinc-600" />
            </Link>
            <Link
              to="/trusted"
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-zinc-300">Add trusted contacts ({contacts.length}/3)</span>
              {contacts.length >= 1 ? (
                <CheckCircle2 className="w-5 h-5 text-tg-safe" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-zinc-600" />
              )}
            </Link>
          </div>
        </div>
      )}

      {/* SOS Button */}
      <div className="flex flex-col items-center py-8">
        <div className="relative">
          {/* Pulse Rings */}
          {sosActive && (
            <>
              <div className="sos-ring animate-pulse-ring" />
              <div className="sos-ring animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
              <div className="sos-ring animate-pulse-ring" style={{ animationDelay: '1s' }} />
            </>
          )}

          {/* SOS Button */}
          <button
            className={`sos-button ${sosActive ? 'active' : ''}`}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            data-testid="sos-trigger"
          >
            {/* Progress Ring */}
            {!sosActive && holdProgress > 0 && (
              <svg className="progress-ring" viewBox="0 0 200 200">
                <circle className="bg" cx="100" cy="100" r="90" />
                <circle 
                  className="progress" 
                  cx="100" 
                  cy="100" 
                  r="90"
                  style={{ strokeDashoffset }}
                />
              </svg>
            )}

            <div className="text-center z-10">
              <ShieldAlert className="w-12 h-12 mx-auto mb-2 text-white" />
              <span className="text-2xl font-bold text-white tg-heading">
                {sosActive ? 'TAP TO RESOLVE' : 'SOS'}
              </span>
              {!sosActive && (
                <p className="text-xs text-white/70 mt-1">Hold for 3 seconds</p>
              )}
            </div>
          </button>
        </div>

        {sosActive && activeIncident && (
          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">Incident ID: {activeIncident.id.slice(0, 8)}</p>
            <p className="text-zinc-400 text-sm">Alerts sent: {activeIncident.alerts_sent_count || 0}</p>
            <p className="text-tg-safe text-xs mt-2">📍 Live location tracking active</p>
          </div>
        )}
      </div>

      {/* Evidence Capture (shown during active SOS) */}
      {sosActive && showEvidenceCapture && (
        <EvidenceCapture
          onEvidenceCapture={handleEvidenceCapture}
          autoStart={profile?.auto_evidence_capture}
          incidentId={activeIncident?.id}
        />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/trusted"
          className="tg-card p-4 text-center hover:border-tg-safe/30 transition-colors"
          data-testid="quick-trusted"
        >
          <Users className="w-8 h-8 mx-auto mb-2 text-tg-safe" />
          <p className="text-sm font-medium">Trusted Circle</p>
          <p className="text-xs text-zinc-500">{contacts.length} contacts</p>
        </Link>

        <Link
          to="/trips"
          className="tg-card p-4 text-center hover:border-tg-warning/30 transition-colors"
          data-testid="quick-trips"
        >
          <MapPin className="w-8 h-8 mx-auto mb-2 text-tg-warning" />
          <p className="text-sm font-medium">Trip Monitor</p>
          <p className="text-xs text-zinc-500">Track journeys</p>
        </Link>

        <Link
          to="/safe-zones"
          className="tg-card p-4 text-center hover:border-blue-500/30 transition-colors"
          data-testid="quick-zones"
        >
          <Navigation className="w-8 h-8 mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium">Safe Zones</p>
          <p className="text-xs text-zinc-500">Geofencing</p>
        </Link>

        <button
          onClick={sendTestAlert}
          disabled={sendingTest || contacts.length === 0}
          className="tg-card p-4 text-center hover:border-purple-500/30 transition-colors disabled:opacity-50"
          data-testid="test-alert-btn"
        >
          {sendingTest ? (
            <Loader2 className="w-8 h-8 mx-auto mb-2 text-purple-500 animate-spin" />
          ) : (
            <Send className="w-8 h-8 mx-auto mb-2 text-purple-500" />
          )}
          <p className="text-sm font-medium">Test Alert</p>
          <p className="text-xs text-zinc-500">Send test SMS</p>
        </button>
      </div>

      {/* Voice-Activated SOS */}
      <VoiceSOS 
        onSOSTriggered={activateSOS}
        disabled={sosActive}
      />

      {/* Quick Access - Nearest Safety Points */}
      <QuickAccess />

      {/* Emergency Contacts Preview */}
      {contacts.length > 0 && (
        <div className="tg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Phone className="w-5 h-5 text-tg-safe" />
              Emergency Contacts
            </h3>
            <Link to="/trusted" className="text-sm text-tg-safe hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {contacts.slice(0, 3).map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50">
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-sm font-semibold">{contact.name.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-xs text-zinc-500">{contact.phone}</p>
                </div>
                <span className="badge badge-safe text-xs">{contact.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Resolve Emergency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-zinc-400 text-sm">
              Enter your resolution PIN to mark this emergency as resolved.
            </p>
            <Input
              type="password"
              placeholder="Enter PIN"
              value={resolvePin}
              onChange={(e) => setResolvePin(e.target.value)}
              className="bg-zinc-800 border-zinc-700"
              data-testid="resolve-pin-input"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setResolveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-tg-safe hover:bg-tg-safe/90"
                onClick={handleResolve}
                disabled={resolving || !resolvePin.trim()}
                data-testid="resolve-submit"
              >
                {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolve'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
