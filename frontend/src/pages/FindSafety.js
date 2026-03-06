import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Phone, Hospital, Building2, Shield, Navigation, Compass, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { LocationMap } from '../components/LocationMap';

// Nigerian emergency resources
const emergencyResources = {
  police: [
    { name: 'Nigeria Police Emergency', phone: '112', type: 'Emergency Line' },
    { name: 'Police Emergency', phone: '199', type: 'Police' },
    { name: 'Lagos State Emergency', phone: '767', type: 'State Emergency' }
  ],
  medical: [
    { name: 'National Emergency', phone: '112', type: 'Emergency' },
    { name: 'Lagos Ambulance Service', phone: '0800-call-lasambus', type: 'Ambulance' }
  ],
  fire: [
    { name: 'Fire Service', phone: '193', type: 'Fire Emergency' }
  ]
};

const FindSafety = () => {
  const { api } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
          setLoading(false);
        },
        (error) => {
          console.error('Location error:', error);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLoading(false);
    }

    // Get compass heading if available
    if ('DeviceOrientationEvent' in window) {
      const handleOrientation = (event) => {
        if (event.webkitCompassHeading) {
          setHeading(event.webkitCompassHeading);
        } else if (event.alpha) {
          setHeading(360 - event.alpha);
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, []);

  useEffect(() => {
    // Fetch user's safe zones
    const fetchZones = async () => {
      try {
        const response = await api.get('/safe-zones');
        setZones(response.data || []);
      } catch (error) {
        console.error('Error fetching zones:', error);
      }
    };
    fetchZones();
  }, [api]);

  const getDirectionToNearest = () => {
    if (!userLocation || zones.length === 0) return null;

    // Find nearest safe zone
    let nearest = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        zone.latitude, zone.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = zone;
      }
    }

    if (nearest) {
      const bearing = calculateBearing(
        userLocation.latitude, userLocation.longitude,
        nearest.latitude, nearest.longitude
      );
      return {
        zone: nearest,
        distance: minDistance,
        bearing
      };
    }

    return null;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const nearestDirection = getDirectionToNearest();

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="find-safety-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <Navigation className="w-7 h-7 text-tg-safe" />
          Find Safety
        </h1>
        <p className="text-zinc-500 mt-1">Emergency resources and navigation</p>
      </div>

      {/* Compass & Location */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Compass Card */}
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-400" />
            Compass
          </h2>
          <div className="flex flex-col items-center">
            <div 
              className="w-32 h-32 rounded-full border-4 border-zinc-700 relative flex items-center justify-center"
              style={{ transform: heading ? `rotate(${-heading}deg)` : 'none' }}
            >
              <div className="absolute top-2 text-tg-danger font-bold">N</div>
              <div className="absolute bottom-2 text-zinc-500">S</div>
              <div className="absolute left-2 text-zinc-500">W</div>
              <div className="absolute right-2 text-zinc-500">E</div>
              <div className="w-2 h-12 bg-gradient-to-b from-tg-danger to-zinc-600 rounded-full" />
            </div>
            <p className="text-zinc-500 text-sm mt-4">
              {heading !== null ? `${Math.round(heading)}°` : 'Compass unavailable'}
            </p>
          </div>
        </div>

        {/* GPS Coordinates */}
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-tg-warning" />
            GPS Coordinates
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : userLocation ? (
            <div className="space-y-3">
              <div className="p-3 bg-zinc-800/50 rounded-lg font-mono text-sm">
                <span className="text-zinc-500">Lat: </span>
                <span className="text-tg-safe">{userLocation.latitude.toFixed(6)}</span>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg font-mono text-sm">
                <span className="text-zinc-500">Lng: </span>
                <span className="text-tg-safe">{userLocation.longitude.toFixed(6)}</span>
              </div>
              <div className="text-xs text-zinc-500">
                Accuracy: ±{Math.round(userLocation.accuracy)}m
              </div>
              <a
                href={`https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-full text-sm mt-2"
              >
                Open in Maps
              </a>
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-8">Location unavailable</p>
          )}
        </div>
      </div>

      {/* Nearest Safe Zone Direction */}
      {nearestDirection && (
        <div className="tg-card p-6 bg-tg-safe/5 border-tg-safe/30">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-tg-safe">
            <Shield className="w-5 h-5" />
            Nearest Safe Zone
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-bold">{nearestDirection.zone.name}</p>
              <p className="text-zinc-400">{formatDistance(nearestDirection.distance)} away</p>
            </div>
            <div className="text-right">
              <div 
                className="w-12 h-12 rounded-full bg-tg-safe/20 flex items-center justify-center"
                style={{ transform: `rotate(${nearestDirection.bearing}deg)` }}
              >
                <Navigation className="w-6 h-6 text-tg-safe" />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{Math.round(nearestDirection.bearing)}°</p>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      {userLocation && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            Your Location
          </h2>
          <LocationMap
            center={[userLocation.latitude, userLocation.longitude]}
            zoom={15}
            markers={[{
              id: 'user',
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              name: 'Your Location',
              status: 'safe'
            }]}
            zones={zones}
            height="300px"
          />
        </div>
      )}

      {/* Emergency Numbers */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-tg-danger" />
          Emergency Numbers
        </h2>
        
        <div className="space-y-4">
          {/* Police */}
          <div>
            <p className="tg-label mb-2">Police</p>
            <div className="space-y-2">
              {emergencyResources.police.map((resource, index) => (
                <a
                  key={index}
                  href={`tel:${resource.phone}`}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-xs text-zinc-500">{resource.type}</p>
                    </div>
                  </div>
                  <span className="text-tg-safe font-mono">{resource.phone}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Medical */}
          <div>
            <p className="tg-label mb-2">Medical</p>
            <div className="space-y-2">
              {emergencyResources.medical.map((resource, index) => (
                <a
                  key={index}
                  href={`tel:${resource.phone}`}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Hospital className="w-5 h-5 text-tg-danger" />
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-xs text-zinc-500">{resource.type}</p>
                    </div>
                  </div>
                  <span className="text-tg-safe font-mono">{resource.phone}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Fire */}
          <div>
            <p className="tg-label mb-2">Fire Service</p>
            <div className="space-y-2">
              {emergencyResources.fire.map((resource, index) => (
                <a
                  key={index}
                  href={`tel:${resource.phone}`}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-tg-warning" />
                    <div>
                      <p className="font-medium">{resource.name}</p>
                      <p className="text-xs text-zinc-500">{resource.type}</p>
                    </div>
                  </div>
                  <span className="text-tg-safe font-mono">{resource.phone}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="tg-card p-4 bg-tg-warning/5 border-tg-warning/20">
        <p className="font-medium text-tg-warning mb-2">Safety Tips</p>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>• Stay calm and assess your surroundings</li>
          <li>• Move to a well-lit, populated area if possible</li>
          <li>• Keep your phone charged and accessible</li>
          <li>• Share your location with trusted contacts</li>
          <li>• If in immediate danger, call emergency services first</li>
        </ul>
      </div>
    </div>
  );
};

export default FindSafety;
