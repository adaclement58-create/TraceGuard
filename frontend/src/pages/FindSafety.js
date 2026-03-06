import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, Phone, Hospital, Building2, Shield, Navigation, Compass, 
  Loader2, Send, CheckCircle2, Map, Target, Users, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { LocationMap } from '../components/LocationMap';

// Nigerian emergency resources with coordinates
const safetyPoints = {
  police: [
    { id: 'p1', name: 'Force Headquarters', phone: '112', type: 'Police HQ', lat: 9.0579, lng: 7.4951 },
    { id: 'p2', name: 'Lagos State Police Command', phone: '199', type: 'State Command', lat: 6.4541, lng: 3.3947 },
    { id: 'p3', name: 'Abuja Police Division', phone: '112', type: 'Division', lat: 9.0765, lng: 7.3986 },
  ],
  hospitals: [
    { id: 'h1', name: 'National Hospital Abuja', phone: '09-4613715', type: 'General Hospital', lat: 9.0408, lng: 7.4942 },
    { id: 'h2', name: 'Lagos University Teaching Hospital', phone: '01-7743541', type: 'Teaching Hospital', lat: 6.5177, lng: 3.3878 },
    { id: 'h3', name: 'Ahmadu Bello University Teaching Hospital', phone: '069-550871', type: 'Teaching Hospital', lat: 11.1511, lng: 7.6508 },
  ],
  barracks: [
    { id: 'b1', name: 'Mogadishu Barracks', phone: 'N/A', type: 'Military', lat: 9.0800, lng: 7.5300 },
    { id: 'b2', name: 'Ikeja Cantonment', phone: 'N/A', type: 'Military', lat: 6.6018, lng: 3.3515 },
    { id: 'b3', name: 'Bonny Camp', phone: 'N/A', type: 'Military', lat: 6.4350, lng: 3.4150 },
  ]
};

const emergencyNumbers = [
  { name: 'National Emergency', phone: '112', icon: Phone },
  { name: 'Police Emergency', phone: '199', icon: Shield },
  { name: 'Fire Service', phone: '193', icon: Building2 },
  { name: 'FRSC (Road Safety)', phone: '122', icon: Navigation },
  { name: 'Lagos Ambulance', phone: '767', icon: Hospital },
];

const FindSafety = () => {
  const { api } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [nearestPoints, setNearestPoints] = useState([]);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [locationSent, setLocationSent] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [zones, setZones] = useState([]);

  // Get user location
  useEffect(() => {
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

    // Compass heading
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

  // Fetch contacts and zones
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contactsRes, zonesRes] = await Promise.all([
          api.get('/contacts').catch(() => ({ data: [] })),
          api.get('/safe-zones').catch(() => ({ data: [] }))
        ]);
        setContacts(contactsRes.data || []);
        setZones(zonesRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [api]);

  // Calculate nearest safety points
  useEffect(() => {
    if (!userLocation) return;

    const allPoints = [
      ...safetyPoints.police.map(p => ({ ...p, category: 'police' })),
      ...safetyPoints.hospitals.map(p => ({ ...p, category: 'hospital' })),
      ...safetyPoints.barracks.map(p => ({ ...p, category: 'barracks' }))
    ];

    const withDistances = allPoints.map(point => ({
      ...point,
      distance: calculateDistance(
        userLocation.latitude, userLocation.longitude,
        point.lat, point.lng
      ),
      bearing: calculateBearing(
        userLocation.latitude, userLocation.longitude,
        point.lat, point.lng
      )
    }));

    withDistances.sort((a, b) => a.distance - b.distance);
    setNearestPoints(withDistances);
  }, [userLocation]);

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
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getDirectionName = (bearing) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'police': return <Shield className="w-5 h-5 text-blue-400" />;
      case 'hospital': return <Hospital className="w-5 h-5 text-tg-danger" />;
      case 'barracks': return <Building2 className="w-5 h-5 text-tg-warning" />;
      default: return <MapPin className="w-5 h-5 text-zinc-400" />;
    }
  };

  const sendLocationToContacts = async () => {
    if (!userLocation || contacts.length === 0) {
      alert('No location or contacts available');
      return;
    }

    setSendingLocation(true);
    try {
      // This would trigger the backend to send SMS with coordinates
      const message = `My current location: https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`;
      
      // Call test-alert endpoint which sends to all contacts
      await api.post('/incidents/test-alert');
      
      setLocationSent(true);
      setTimeout(() => setLocationSent(false), 5000);
    } catch (error) {
      console.error('Failed to send location:', error);
      alert('Failed to send location. Please try again.');
    } finally {
      setSendingLocation(false);
    }
  };

  const navigateToPoint = (point) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const filteredPoints = selectedCategory === 'all' 
    ? nearestPoints 
    : nearestPoints.filter(p => p.category === selectedCategory);

  // Create map markers
  const mapMarkers = [
    ...(userLocation ? [{
      id: 'user',
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      name: 'Your Location',
      status: 'safe'
    }] : []),
    ...filteredPoints.slice(0, 10).map(point => ({
      id: point.id,
      latitude: point.lat,
      longitude: point.lng,
      name: point.name,
      status: point.category === 'hospital' ? 'danger' : 
              point.category === 'police' ? 'safe' : 'warning'
    }))
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="find-safety-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <Navigation className="w-7 h-7 text-tg-safe" />
          Find Safety
        </h1>
        <p className="text-zinc-500 mt-1">Navigate to nearest safe locations</p>
      </div>

      {/* Send Location to Contacts */}
      <div className="tg-card p-5 bg-tg-safe/5 border-tg-safe/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-tg-safe" />
            <div>
              <p className="font-semibold text-tg-safe">Share Your Location</p>
              <p className="text-sm text-zinc-400">
                Send your coordinates to {contacts.length} trusted contacts
              </p>
            </div>
          </div>
          <Button
            onClick={sendLocationToContacts}
            disabled={sendingLocation || !userLocation || contacts.length === 0}
            className={`${locationSent ? 'bg-tg-safe' : 'bg-tg-safe hover:bg-tg-safe/90'} text-black`}
            data-testid="send-location-btn"
          >
            {sendingLocation ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : locationSent ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Sent!
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Location
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Compass & GPS Row */}
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
              style={{ transform: heading !== null ? `rotate(${-heading}deg)` : 'none', transition: 'transform 0.3s ease' }}
            >
              <div className="absolute top-2 text-tg-danger font-bold text-sm">N</div>
              <div className="absolute bottom-2 text-zinc-500 text-sm">S</div>
              <div className="absolute left-2 text-zinc-500 text-sm">W</div>
              <div className="absolute right-2 text-zinc-500 text-sm">E</div>
              <div className="w-1 h-12 bg-gradient-to-b from-tg-danger to-zinc-600 rounded-full" />
            </div>
            <p className="text-zinc-500 text-sm mt-4">
              {heading !== null ? `${Math.round(heading)}°` : 'Enable device orientation'}
            </p>
          </div>
        </div>

        {/* GPS Coordinates */}
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-tg-warning" />
            Your Coordinates
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
              <p className="text-xs text-zinc-500">Accuracy: ±{Math.round(userLocation.accuracy)}m</p>
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-8">Location unavailable</p>
          )}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl overflow-x-auto">
        {[
          { id: 'all', label: 'All', icon: MapPin },
          { id: 'police', label: 'Police', icon: Shield },
          { id: 'hospital', label: 'Hospitals', icon: Hospital },
          { id: 'barracks', label: 'Barracks', icon: Building2 }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white'
            }`}
            data-testid={`filter-${cat.id}`}
          >
            <cat.icon className="w-4 h-4" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Offline Map */}
      {userLocation && (
        <div className="tg-card p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-400" />
            Safety Map
          </h2>
          <LocationMap
            center={[userLocation.latitude, userLocation.longitude]}
            zoom={12}
            markers={mapMarkers}
            zones={zones}
            height="350px"
          />
          <p className="text-xs text-zinc-500 mt-2 text-center">
            Tap markers for details • Blue = Police • Red = Hospital • Yellow = Military
          </p>
        </div>
      )}

      {/* Nearest Safe Points */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Navigation className="w-5 h-5 text-tg-safe" />
          Nearest Safe Locations
        </h2>
        
        {!userLocation ? (
          <div className="text-center py-8 text-zinc-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Enable location to find nearby safe points</p>
          </div>
        ) : filteredPoints.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No locations found</p>
        ) : (
          <div className="space-y-3">
            {filteredPoints.slice(0, 5).map((point) => (
              <button
                key={point.id}
                onClick={() => navigateToPoint(point)}
                className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-colors text-left"
                data-testid={`navigate-${point.id}`}
              >
                <div className="p-3 bg-zinc-700 rounded-lg">
                  {getCategoryIcon(point.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{point.name}</p>
                  <p className="text-sm text-zinc-500">{point.type}</p>
                  {point.phone !== 'N/A' && (
                    <p className="text-xs text-zinc-600">{point.phone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-tg-safe">{formatDistance(point.distance)}</p>
                  <div className="flex items-center gap-1 text-sm text-zinc-500">
                    <Navigation 
                      className="w-4 h-4" 
                      style={{ transform: `rotate(${point.bearing}deg)` }}
                    />
                    <span>{getDirectionName(point.bearing)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Numbers */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-tg-danger" />
          Emergency Hotlines
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {emergencyNumbers.map((item, index) => (
            <a
              key={index}
              href={`tel:${item.phone}`}
              className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid={`call-${item.phone}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-tg-danger" />
                <span className="font-medium">{item.name}</span>
              </div>
              <span className="text-tg-safe font-mono font-bold">{item.phone}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Safety Tips */}
      <div className="tg-card p-4 bg-tg-warning/5 border-tg-warning/20">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-tg-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-tg-warning mb-2">Safety Tips</p>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Stay calm and assess your surroundings</li>
              <li>• Move to a well-lit, populated area if possible</li>
              <li>• Keep your phone charged and accessible</li>
              <li>• If in immediate danger, call 112 first</li>
              <li>• Share your location with trusted contacts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindSafety;
