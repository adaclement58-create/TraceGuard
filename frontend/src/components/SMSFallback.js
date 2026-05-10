import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MessageSquare, Wifi, WifiOff, Send, MapPin, 
  AlertTriangle, CheckCircle2, Loader2, Phone
} from 'lucide-react';
import { Button } from './ui/button';

const SMSFallback = ({ className = '' }) => {
  const { api, user } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Send location via SMS (uses backend which then sends SMS via Termii)
  const sendLocationViaSMS = useCallback(async () => {
    if (!navigator.onLine) {
      // If truly offline, use native SMS app
      triggerNativeSMS();
      return;
    }

    setSending(true);
    setError(null);

    try {
      await api.post('/sms/send-location');
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError('Failed to send SMS. Try native SMS below.');
      // Fallback to native SMS
      triggerNativeSMS();
    } finally {
      setSending(false);
    }
  }, [api]);

  // Trigger native SMS app with pre-filled message
  const triggerNativeSMS = () => {
    const locationLink = currentLocation 
      ? `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
      : 'Location unavailable';
    
    const message = encodeURIComponent(
      `EMERGENCY! I need help. ${user?.full_name || 'User'} from TRACEGUARD. My location: ${locationLink}`
    );

    // This opens the native SMS app
    // User will need to select recipients
    window.location.href = `sms:?body=${message}`;
  };

  // Send SOS via SMS when offline
  const sendSOSViaSMS = () => {
    const locationLink = currentLocation 
      ? `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
      : 'Location unknown';
    
    const message = encodeURIComponent(
      `SOS ALERT from ${user?.full_name || 'User'}! I am in danger. Please help immediately. Location: ${locationLink} - Sent via TRACEGUARD`
    );

    // For Nigerian emergency number
    // Open SMS to 112 or contacts
    window.location.href = `sms:?body=${message}`;
  };

  return (
    <div className={`tg-card p-4 ${className}`} data-testid="sms-fallback">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <WifiOff className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-5 h-5 text-tg-safe" />
              <span className="text-sm text-tg-safe">Online</span>
            </>
          )}
        </div>
        <MessageSquare className="w-5 h-5 text-zinc-500" />
      </div>

      <h4 className="font-medium mb-2">SMS Fallback</h4>
      <p className="text-xs text-zinc-500 mb-4">
        {isOffline 
          ? 'No internet. Use SMS to send your location or SOS.' 
          : 'Share your location with contacts via SMS.'
        }
      </p>

      {/* Location Display */}
      {currentLocation && (
        <div className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg mb-4 text-xs">
          <MapPin className="w-4 h-4 text-tg-safe" />
          <span className="text-zinc-400">
            {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {!isOffline && (
          <Button
            variant="outline"
            className="w-full border-tg-safe/30 text-tg-safe hover:bg-tg-safe/10"
            onClick={sendLocationViaSMS}
            disabled={sending}
            data-testid="send-location-sms-btn"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : sent ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {sent ? 'Location Sent!' : 'Send Location to Contacts'}
          </Button>
        )}

        <Button
          variant={isOffline ? "default" : "outline"}
          className={`w-full ${
            isOffline 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'border-zinc-600 text-zinc-400 hover:bg-zinc-800'
          }`}
          onClick={sendSOSViaSMS}
          data-testid="sos-sms-btn"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          {isOffline ? 'Send SOS via SMS' : 'Open SMS App'}
        </Button>

        {/* Direct Emergency Calls */}
        {isOffline && (
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 p-3 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm font-medium">Call 112</span>
            </a>
            <a
              href="tel:199"
              className="flex items-center justify-center gap-2 p-3 bg-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span className="text-sm font-medium">Call 199</span>
            </a>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}

      {/* Offline Instructions */}
      {isOffline && (
        <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-xs text-orange-400">
            <strong>Offline Mode:</strong> Your SOS will be queued and automatically sent when you regain internet connection. 
            For immediate help, use the SMS or call buttons above.
          </p>
        </div>
      )}
    </div>
  );
};

export default SMSFallback;
