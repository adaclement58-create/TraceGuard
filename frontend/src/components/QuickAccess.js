import React, { useState, useEffect } from 'react';
import { Shield, Hospital, Navigation, Phone, Loader2, MapPin, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

// Nigerian emergency resources with coordinates
const SAFETY_POINTS = {
  police: [
    { id: 'p1', name: 'Force Headquarters', phone: '112', lat: 9.0579, lng: 7.4951, city: 'Abuja' },
    { id: 'p2', name: 'Lagos State Police Command', phone: '199', lat: 6.4541, lng: 3.3947, city: 'Lagos' },
    { id: 'p3', name: 'Abuja Police Division', phone: '112', lat: 9.0765, lng: 7.3986, city: 'Abuja' },
    { id: 'p4', name: 'Port Harcourt Police', phone: '112', lat: 4.8156, lng: 7.0498, city: 'Port Harcourt' },
    { id: 'p5', name: 'Kano Police Command', phone: '112', lat: 12.0022, lng: 8.5920, city: 'Kano' },
  ],
  hospitals: [
    { id: 'h1', name: 'National Hospital Abuja', phone: '09-4613715', lat: 9.0408, lng: 7.4942, city: 'Abuja' },
    { id: 'h2', name: 'Lagos University Teaching Hospital', phone: '01-7743541', lat: 6.5177, lng: 3.3878, city: 'Lagos' },
    { id: 'h3', name: 'Ahmadu Bello University Teaching Hospital', phone: '069-550871', lat: 11.1511, lng: 7.6508, city: 'Zaria' },
    { id: 'h4', name: 'University of Port Harcourt Teaching Hospital', phone: '084-230011', lat: 4.8960, lng: 6.9220, city: 'Port Harcourt' },
    { id: 'h5', name: 'Lagos State Emergency', phone: '767', lat: 6.4281, lng: 3.4219, city: 'Lagos' },
  ]
};

const QuickAccess = ({ className = '' }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nearestPolice, setNearestPolice] = useState(null);
  const [nearestHospital, setNearestHospital] = useState(null);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Format distance for display
  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Find nearest locations
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          
          // Find nearest police station
          let minPoliceDistance = Infinity;
          let closestPolice = null;
          
          for (const station of SAFETY_POINTS.police) {
            const distance = calculateDistance(latitude, longitude, station.lat, station.lng);
            if (distance < minPoliceDistance) {
              minPoliceDistance = distance;
              closestPolice = { ...station, distance };
            }
          }
          setNearestPolice(closestPolice);
          
          // Find nearest hospital
          let minHospitalDistance = Infinity;
          let closestHospital = null;
          
          for (const hospital of SAFETY_POINTS.hospitals) {
            const distance = calculateDistance(latitude, longitude, hospital.lat, hospital.lng);
            if (distance < minHospitalDistance) {
              minHospitalDistance = distance;
              closestHospital = { ...hospital, distance };
            }
          }
          setNearestHospital(closestHospital);
          
          setLoading(false);
        },
        (error) => {
          console.error('Location error:', error);
          // Use default locations (Lagos)
          setNearestPolice({ ...SAFETY_POINTS.police[1], distance: null });
          setNearestHospital({ ...SAFETY_POINTS.hospitals[1], distance: null });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLoading(false);
    }
  }, []);

  // Navigate to location
  const navigateTo = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Call phone number
  const callNumber = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  if (loading) {
    return (
      <div className={`tg-card p-4 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-500">Finding nearest safety points...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`tg-card p-4 ${className}`} data-testid="quick-access-widget">
      <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
        <Navigation className="w-4 h-4 text-tg-safe" />
        Quick Access - Nearest Safety
      </h3>
      
      <div className="grid gap-3 md:grid-cols-2">
        {/* Nearest Police */}
        {nearestPolice && (
          <div 
            className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl"
            data-testid="nearest-police"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-blue-400">Police</span>
              </div>
              {nearestPolice.distance && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  {formatDistance(nearestPolice.distance)}
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{nearestPolice.name}</p>
            <p className="text-xs text-zinc-500 mb-2">{nearestPolice.city}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-blue-500/30 hover:bg-blue-500/10"
                onClick={() => callNumber(nearestPolice.phone)}
              >
                <Phone className="w-3 h-3 mr-1" />
                {nearestPolice.phone}
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => navigateTo(nearestPolice.lat, nearestPolice.lng)}
              >
                <Navigation className="w-3 h-3 mr-1" />
                Navigate
              </Button>
            </div>
          </div>
        )}

        {/* Nearest Hospital */}
        {nearestHospital && (
          <div 
            className="p-3 bg-tg-danger/10 border border-tg-danger/20 rounded-xl"
            data-testid="nearest-hospital"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Hospital className="w-5 h-5 text-tg-danger" />
                <span className="font-semibold text-tg-danger">Hospital</span>
              </div>
              {nearestHospital.distance && (
                <span className="text-xs bg-tg-danger/20 text-tg-danger px-2 py-0.5 rounded-full">
                  {formatDistance(nearestHospital.distance)}
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{nearestHospital.name}</p>
            <p className="text-xs text-zinc-500 mb-2">{nearestHospital.city}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs border-tg-danger/30 hover:bg-tg-danger/10"
                onClick={() => callNumber(nearestHospital.phone)}
              >
                <Phone className="w-3 h-3 mr-1" />
                Call
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-tg-danger hover:bg-tg-danger/90 text-white"
                onClick={() => navigateTo(nearestHospital.lat, nearestHospital.lng)}
              >
                <Navigation className="w-3 h-3 mr-1" />
                Navigate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Numbers */}
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Emergency Hotlines:</span>
          <div className="flex gap-2">
            <a href="tel:112" className="text-tg-safe hover:underline">112</a>
            <span className="text-zinc-700">|</span>
            <a href="tel:199" className="text-tg-safe hover:underline">199</a>
            <span className="text-zinc-700">|</span>
            <a href="tel:767" className="text-tg-safe hover:underline">767</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAccess;
