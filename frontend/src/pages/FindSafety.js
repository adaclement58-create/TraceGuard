import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Hospital, Building2, Navigation, Phone, Loader2, 
  MapPin, Share2, Compass, Download, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createIcon = (color) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const userIcon = createIcon('#10b981');
const policeIcon = createIcon('#3b82f6');
const hospitalIcon = createIcon('#ef4444');
const barracksIcon = createIcon('#22c55e');

// Place type configurations
const PLACE_TYPES = {
  police: { 
    label: 'Police', 
    icon: Shield, 
    markerIcon: policeIcon,
    color: 'blue',
    amenity: 'police',
    keyword: 'police station'
  },
  hospital: { 
    label: 'Hospital', 
    icon: Hospital, 
    markerIcon: hospitalIcon,
    color: 'red',
    amenity: 'hospital',
    keyword: 'hospital'
  },
  barracks: { 
    label: 'Barracks', 
    icon: Building2, 
    markerIcon: barracksIcon,
    color: 'green',
    amenity: 'military',
    keyword: 'military barracks'
  }
};

// Map center component
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 13);
    }
  }, [center, map]);
  return null;
}

const FindSafety = () => {
  const { userLocation, api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('police');
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [compassSupported, setCompassSupported] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [cachedAreas, setCachedAreas] = useState([]);

  // Get current location
  useEffect(() => {
    if (userLocation) {
      setCurrentLocation({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
      setLoading(false);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLoading(false);
        },
        (error) => {
          console.error('Location error:', error);
          // Default to Lagos
          setCurrentLocation({ lat: 6.5244, lng: 3.3792 });
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [userLocation]);

  // Initialize compass with device orientation
  useEffect(() => {
    const handleOrientation = (event) => {
      let heading = 0;
      
      if (event.webkitCompassHeading !== undefined) {
        // iOS
        heading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        // Android - alpha is the compass direction
        heading = 360 - event.alpha;
      }
      
      setCompassHeading(Math.round(heading));
      setCompassSupported(true);
    };

    // Check if device orientation is available
    if (window.DeviceOrientationEvent) {
      // iOS 13+ requires permission
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        setCompassSupported(false);
      } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
        setCompassSupported(true);
      }
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Request compass permission (iOS)
  const requestCompassPermission = async () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', (event) => {
            let heading = event.webkitCompassHeading || (360 - event.alpha) || 0;
            setCompassHeading(Math.round(heading));
            setCompassSupported(true);
          }, true);
        }
      } catch (error) {
        console.error('Compass permission error:', error);
        alert('Could not enable compass. Please check device settings.');
      }
    }
  };

  // Search nearby places using OpenStreetMap Overpass API
  const searchNearbyPlaces = useCallback(async (category) => {
    if (!currentLocation) return;
    
    setSearchingPlaces(true);
    const config = PLACE_TYPES[category];
    
    // Build Overpass query
    let amenityQuery = '';
    if (category === 'barracks') {
      amenityQuery = `node[military](around:15000,${currentLocation.lat},${currentLocation.lng});
                      way[military](around:15000,${currentLocation.lat},${currentLocation.lng});
                      node[landuse=military](around:15000,${currentLocation.lat},${currentLocation.lng});
                      way[landuse=military](around:15000,${currentLocation.lat},${currentLocation.lng});`;
    } else {
      amenityQuery = `node[amenity=${config.amenity}](around:10000,${currentLocation.lat},${currentLocation.lng});
                      way[amenity=${config.amenity}](around:10000,${currentLocation.lat},${currentLocation.lng});`;
    }

    const query = `
      [out:json][timeout:25];
      (
        ${amenityQuery}
      );
      out center;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query
      });
      const data = await response.json();
      
      const places = data.elements
        .map((el, index) => {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          
          if (!lat || !lng) return null;
          
          const distance = calculateDistance(currentLocation.lat, currentLocation.lng, lat, lng);
          
          return {
            id: el.id || index,
            name: el.tags?.name || `${config.label} ${index + 1}`,
            address: el.tags?.['addr:street'] 
              ? `${el.tags?.['addr:housenumber'] || ''} ${el.tags?.['addr:street']}`.trim()
              : el.tags?.['addr:full'] || 'Address not available',
            lat,
            lng,
            distance,
            phone: el.tags?.phone || el.tags?.['contact:phone'],
            website: el.tags?.website,
            opening_hours: el.tags?.opening_hours
          };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.distance - b.distance);
      
      setNearbyPlaces(places);
    } catch (error) {
      console.error('Search error:', error);
      setNearbyPlaces([]);
    } finally {
      setSearchingPlaces(false);
    }
  }, [currentLocation]);

  // Calculate distance between two points (Haversine)
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

  // Format distance
  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Handle category change
  useEffect(() => {
    if (currentLocation) {
      searchNearbyPlaces(selectedCategory);
    }
  }, [selectedCategory, currentLocation, searchNearbyPlaces]);

  // Navigate to place
  const navigateToPlace = (place) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Call place
  const callPlace = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  // Share location with trusted contacts
  const shareLocationWithContacts = async () => {
    setSharingLocation(true);
    try {
      const response = await api.get('/contacts');
      const contacts = response.data;
      
      if (contacts.length === 0) {
        alert('No trusted contacts found. Add contacts in Trusted Circle.');
        return;
      }

      await api.post('/incidents/test-alert', {
        message: `My current location: https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng
      });
      
      alert('Location shared with your trusted contacts!');
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share location. Please try again.');
    } finally {
      setSharingLocation(false);
    }
  };

  // Download area for offline use
  const downloadAreaForOffline = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          setCachedAreas(prev => [...prev, {
            center: currentLocation,
            name: 'Current Area',
            timestamp: new Date().toISOString()
          }]);
          alert('Map tiles cached for offline use!');
        } else {
          alert('Failed to cache area: ' + (event.data.error || 'Unknown error'));
        }
      };

      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_MAP_AREA',
        bounds: {
          north: currentLocation.lat + 0.05,
          south: currentLocation.lat - 0.05,
          east: currentLocation.lng + 0.05,
          west: currentLocation.lng - 0.05
        },
        zoom: 15
      }, [messageChannel.port2]);
    } else {
      alert('Service worker not ready. Please refresh the page.');
    }
  };

  // Get compass direction name
  const getDirectionName = (heading) => {
    if (heading >= 337.5 || heading < 22.5) return 'North';
    if (heading >= 22.5 && heading < 67.5) return 'NE';
    if (heading >= 67.5 && heading < 112.5) return 'East';
    if (heading >= 112.5 && heading < 157.5) return 'SE';
    if (heading >= 157.5 && heading < 202.5) return 'South';
    if (heading >= 202.5 && heading < 247.5) return 'SW';
    if (heading >= 247.5 && heading < 292.5) return 'West';
    return 'NW';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-tg-safe mx-auto mb-4" />
          <p className="text-zinc-500">Getting your location...</p>
        </div>
      </div>
    );
  }

  const PlaceIcon = PLACE_TYPES[selectedCategory].icon;

  return (
    <div className="space-y-6" data-testid="find-safety-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Navigation className="w-7 h-7 text-tg-safe" />
            Find Safety
          </h1>
          <p className="text-zinc-500 mt-1">Locate nearest emergency services</p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={downloadAreaForOffline}
          className="border-zinc-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Save Offline
        </Button>
      </div>

      {/* Your Location & Share */}
      <div className="tg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tg-safe/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-tg-safe" />
            </div>
            <div>
              <p className="font-medium">Your Location</p>
              <p className="text-xs text-zinc-500">
                {currentLocation ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}` : 'Getting location...'}
              </p>
            </div>
          </div>
          
          <Button
            onClick={shareLocationWithContacts}
            disabled={sharingLocation}
            className="bg-tg-safe hover:bg-tg-safe/90 text-black"
            data-testid="share-location-btn"
          >
            {sharingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share Location
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Compass */}
      <div className="tg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Compass className="w-5 h-5 text-zinc-400" />
            Compass
          </h3>
          {!compassSupported && (
            <Button
              variant="outline"
              size="sm"
              onClick={requestCompassPermission}
              className="text-xs"
            >
              Enable Compass
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            {/* Compass background */}
            <div className="absolute inset-0 rounded-full border-2 border-zinc-700 bg-zinc-800/50" />
            
            {/* Direction labels */}
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-tg-danger">N</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-500">S</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">W</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">E</span>
            
            {/* Compass needle */}
            <div 
              className="absolute inset-4 flex items-center justify-center transition-transform duration-300"
              style={{ transform: `rotate(${compassHeading}deg)` }}
            >
              <div className="w-1 h-full bg-gradient-to-b from-tg-danger to-zinc-600 rounded-full" />
            </div>
            
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-600" />
          </div>
          
          <div className="ml-6 text-center">
            <p className="text-3xl font-bold">{compassHeading}°</p>
            <p className="text-sm text-zinc-500">{getDirectionName(compassHeading)}</p>
            {!compassSupported && (
              <p className="text-xs text-zinc-600 mt-1">Tap "Enable" on mobile</p>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2">
        {Object.entries(PLACE_TYPES).map(([key, config]) => {
          const Icon = config.icon;
          const isActive = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`flex-1 p-3 rounded-xl border transition-all ${
                isActive 
                  ? 'bg-tg-safe/20 border-tg-safe/50 text-tg-safe' 
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
              data-testid={`filter-${key}`}
            >
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xs font-medium">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Map */}
      {currentLocation && (
        <div className="tg-card p-2 overflow-hidden" style={{ height: '320px' }}>
          <MapContainer
            center={[currentLocation.lat, currentLocation.lng]}
            zoom={13}
            style={{ height: '300px', width: '100%', borderRadius: '12px' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapCenterUpdater center={currentLocation} />
            
            {/* User location marker */}
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={userIcon}>
              <Popup>
                <div className="text-center">
                  <strong>You are here</strong>
                </div>
              </Popup>
            </Marker>
            
            {/* Nearby places markers */}
            {nearbyPlaces.map((place) => (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={PLACE_TYPES[selectedCategory].markerIcon}
                eventHandlers={{
                  click: () => setSelectedPlace(place)
                }}
              >
                <Popup>
                  <div className="p-1">
                    <strong>{place.name}</strong>
                    <p className="text-xs text-gray-600">{place.address}</p>
                    <p className="text-xs text-gray-500">{formatDistance(place.distance)} away</p>
                    <button
                      onClick={() => navigateToPlace(place)}
                      className="mt-1 text-xs text-blue-600 hover:underline"
                    >
                      Get Directions →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Nearby Places List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <PlaceIcon className="w-5 h-5 text-zinc-400" />
            Nearest {PLACE_TYPES[selectedCategory].label}s
            {searchingPlaces && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => searchNearbyPlaces(selectedCategory)}
            disabled={searchingPlaces}
            className="text-xs"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${searchingPlaces ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {nearbyPlaces.length === 0 && !searchingPlaces ? (
          <div className="tg-card p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
            <p className="text-zinc-500">No {PLACE_TYPES[selectedCategory].label.toLowerCase()}s found nearby</p>
            <p className="text-xs text-zinc-600 mt-1">Try a different category or check your location</p>
          </div>
        ) : (
          <div className="space-y-2">
            {nearbyPlaces.slice(0, 10).map((place, index) => (
              <div 
                key={place.id}
                className={`tg-card p-4 hover:border-zinc-600 transition-colors cursor-pointer ${
                  selectedPlace?.id === place.id ? 'border-tg-safe/50' : ''
                }`}
                onClick={() => setSelectedPlace(place)}
                data-testid={`place-${index}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <h4 className="font-medium">{place.name}</h4>
                    </div>
                    <p className="text-sm text-zinc-500 mt-1">{place.address}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {formatDistance(place.distance)}
                      </span>
                      {place.opening_hours && (
                        <span className="text-zinc-600">{place.opening_hours}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    {place.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-zinc-700"
                        onClick={(e) => { e.stopPropagation(); callPlace(place.phone); }}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-8 bg-tg-safe hover:bg-tg-safe/90 text-black"
                      onClick={(e) => { e.stopPropagation(); navigateToPlace(place); }}
                    >
                      <Navigation className="w-4 h-4 mr-1" />
                      Go
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Hotlines */}
      <div className="tg-card p-4 bg-tg-danger/10 border-tg-danger/30">
        <h3 className="font-semibold text-tg-danger mb-3 flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Emergency Hotlines
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <a href="tel:112" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50 transition-colors">
            <p className="text-lg font-bold">112</p>
            <p className="text-xs text-zinc-500">Emergency</p>
          </a>
          <a href="tel:199" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50 transition-colors">
            <p className="text-lg font-bold">199</p>
            <p className="text-xs text-zinc-500">Police</p>
          </a>
          <a href="tel:767" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50 transition-colors">
            <p className="text-lg font-bold">767</p>
            <p className="text-xs text-zinc-500">LASEMA</p>
          </a>
        </div>
      </div>

      {/* Offline Areas */}
      {cachedAreas.length > 0 && (
        <div className="tg-card p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Download className="w-5 h-5 text-zinc-400" />
            Offline Areas ({cachedAreas.length})
          </h3>
          <div className="space-y-2">
            {cachedAreas.map((area, index) => (
              <div key={index} className="text-sm text-zinc-500 flex items-center justify-between p-2 bg-zinc-800/30 rounded">
                <span>{area.name}</span>
                <span className="text-xs text-tg-safe">✓ Cached</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FindSafety;
