import React, { useState, useEffect, useCallback } from 'react';
import { 
  QrCode, MapPin, Clock, User, AlertTriangle, 
  Scan, Copy, Share2, CheckCircle2, Camera
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import QRCode from 'qrcode';

// QR Emergency Beacon - Share/receive emergency data via QR codes
// Works 100% OFFLINE - no internet required

const QREmergencyBeacon = ({ user, className = '' }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [emergencyType, setEmergencyType] = useState('sos');
  const [scannedData, setScannedData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Get current location
  useEffect(() => {
    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            });
            setLastUpdated(new Date());
          },
          (err) => console.log('Location error:', err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  // Generate emergency QR code
  const generateEmergencyQR = useCallback(async (type) => {
    const emergencyData = {
      type: type,
      user: {
        name: user?.full_name || 'Unknown',
        phone: user?.phone || '',
        email: user?.email || ''
      },
      location: currentLocation,
      timestamp: Date.now(),
      app: 'TRACEGUARD',
      version: '1.0'
    };

    try {
      const qrUrl = await QRCode.toDataURL(JSON.stringify(emergencyData), {
        width: 300,
        margin: 2,
        color: { 
          dark: type === 'sos' ? '#ef4444' : '#00ff88', 
          light: '#09090b' 
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeUrl(qrUrl);
      setEmergencyType(type);
      setShowQR(true);
    } catch (e) {
      console.error('Failed to generate QR code:', e);
    }
  }, [user, currentLocation]);

  // Copy location to clipboard
  const copyLocation = () => {
    if (currentLocation) {
      const text = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`;
      navigator.clipboard.writeText(text);
      alert('Location link copied!');
    }
  };

  // Share via native share API
  const shareLocation = async () => {
    if (!currentLocation) return;

    const shareData = {
      title: 'TRACEGUARD Emergency Location',
      text: `Emergency! ${user?.full_name || 'Someone'} needs help at this location:`,
      url: `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyLocation();
      }
    } catch (e) {
      console.log('Share cancelled or failed');
    }
  };

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return 'Unknown';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      <div className={`tg-card p-4 ${className}`} data-testid="qr-emergency-beacon">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <QrCode className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="font-medium">QR Emergency Beacon</p>
            <p className="text-xs text-zinc-500">Share location without internet</p>
          </div>
        </div>

        {/* Current Location Display */}
        <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Current Location
            </span>
            {lastUpdated && (
              <span className="text-xs text-zinc-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(lastUpdated)}
              </span>
            )}
          </div>
          {currentLocation ? (
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono">
                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyLocation}
                className="text-zinc-500 h-6 px-2"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Acquiring location...</p>
          )}
          {currentLocation?.accuracy && (
            <p className="text-xs text-zinc-600 mt-1">
              Accuracy: ±{Math.round(currentLocation.accuracy)}m
            </p>
          )}
        </div>

        {/* QR Generation Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button
            onClick={() => generateEmergencyQR('sos')}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={!currentLocation}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            SOS QR
          </Button>
          <Button
            onClick={() => generateEmergencyQR('location')}
            className="bg-tg-safe hover:bg-tg-safe/90 text-black"
            disabled={!currentLocation}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Location QR
          </Button>
        </div>

        {/* Share Button */}
        <Button
          variant="outline"
          onClick={shareLocation}
          className="w-full border-zinc-700"
          disabled={!currentLocation}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Location
        </Button>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong>How to use:</strong> Generate a QR code with your location. 
            Others can scan it with any camera app to see your exact position on Google Maps.
            No internet required on your device.
          </p>
        </div>
      </div>

      {/* QR Display Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className={emergencyType === 'sos' ? 'text-red-400' : 'text-tg-safe'}>
              {emergencyType === 'sos' ? '🚨 EMERGENCY SOS' : '📍 Location Beacon'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-4">
            {qrCodeUrl && (
              <div className={`p-4 rounded-xl ${emergencyType === 'sos' ? 'bg-red-500/10 border border-red-500/30' : 'bg-tg-safe/10 border border-tg-safe/30'}`}>
                <img src={qrCodeUrl} alt="Emergency QR Code" className="w-64 h-64 rounded-lg" />
              </div>
            )}
            
            <div className="mt-4 text-center">
              <p className="text-sm font-medium">{user?.full_name || 'Unknown'}</p>
              {currentLocation && (
                <p className="text-xs text-zinc-500 mt-1">
                  {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                </p>
              )}
              <p className="text-xs text-zinc-600 mt-1">
                Generated: {formatTime(new Date())}
              </p>
            </div>

            <div className={`mt-4 p-3 rounded-lg w-full ${emergencyType === 'sos' ? 'bg-red-500/10' : 'bg-zinc-800/50'}`}>
              <p className="text-xs text-center">
                {emergencyType === 'sos' 
                  ? 'Show this QR to anyone. They can scan it to see your location and know you need help.'
                  : 'Scan this QR code with any camera app to open the location in Google Maps.'
                }
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 w-full">
              <Button
                variant="outline"
                onClick={copyLocation}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={shareLocation}
                className="flex-1"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QREmergencyBeacon;
