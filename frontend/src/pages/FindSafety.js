import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Hospital, Building2, Navigation, Phone, Loader2, 
  MapPin, Share2, Compass, Download, AlertTriangle, RefreshCw,
  Settings, Map as MapIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import OfflineMapManager from '../components/OfflineMapManager';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Check if Google Maps API key looks valid
const isGoogleMapsKeyValid = GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.startsWith('AIza');

// Place type configurations
const PLACE_TYPES = {
  police: { 
    label: 'Police', 
    icon: Shield, 
    color: '#3b82f6',
    googleType: 'police',
    overpassAmenity: 'police',
    keyword: 'police station'
  },
  hospital: { 
    label: 'Hospital', 
    icon: Hospital, 
    color: '#ef4444',
    googleType: 'hospital',
    overpassAmenity: 'hospital',
    keyword: 'hospital'
  },
  barracks: { 
    label: 'Barracks', 
    icon: Building2, 
    color: '#22c55e',
    googleType: 'point_of_interest',
    overpassAmenity: 'military',
    keyword: 'military barracks army'
  }
};

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
  const [mapProvider, setMapProvider] = useState(isGoogleMapsKeyValid ? 'google' : 'leaflet');
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const googleMapRef = useRef(null);
  const leafletMapRef = useRef(null);

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
          setCurrentLocation({ lat: 6.5244, lng: 3.3792 }); // Lagos default
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [userLocation]);

  // Initialize compass
  useEffect(() => {
    const handleOrientation = (event) => {
      let heading = 0;
      if (event.webkitCompassHeading !== undefined) {
        heading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        heading = 360 - event.alpha;
      }
      setCompassHeading(Math.round(heading));
      setCompassSupported(true);
    };

    if (window.DeviceOrientationEvent) {
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
            const heading = event.webkitCompassHeading || (360 - event.alpha) || 0;
            setCompassHeading(Math.round(heading));
            setCompassSupported(true);
          }, true);
        }
      } catch (error) {
        console.error('Compass permission error:', error);
      }
    }
  };

  // Initialize Google Maps
  const initGoogleMap = useCallback(() => {
    if (!mapContainerRef.current || !currentLocation || !window.google) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: currentLocation,
      zoom: 13,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c3e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
      ],
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
    });

    // Add user location marker
    new window.google.maps.Marker({
      position: currentLocation,
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      title: 'You are here',
    });

    googleMapRef.current = map;
    return map;
  }, [currentLocation]);

  // Initialize Leaflet Map
  const initLeafletMap = useCallback(async () => {
    if (!mapContainerRef.current || !currentLocation) return;
    
    // Dynamically import Leaflet
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');

    // Clean up existing map
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
    }

    const map = L.map(mapContainerRef.current).setView(
      [currentLocation.lat, currentLocation.lng],
      13
    );

    // Add tile layer (CartoDB Dark)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add user marker
    const userIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([currentLocation.lat, currentLocation.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup('You are here');

    leafletMapRef.current = map;
    return map;
  }, [currentLocation]);

  // Load map based on provider
  useEffect(() => {
    if (!currentLocation) return;

    const loadMap = async () => {
      if (mapProvider === 'google' && isGoogleMapsKeyValid) {
        // Load Google Maps script
        if (!window.google) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
          script.async = true;
          script.onload = () => initGoogleMap();
          document.head.appendChild(script);
        } else {
          initGoogleMap();
        }
      } else {
        await initLeafletMap();
      }
    };

    loadMap();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [currentLocation, mapProvider, initGoogleMap, initLeafletMap]);

  // Search nearby places using Google Places API
  const searchWithGoogle = useCallback((category) => {
    if (!googleMapRef.current || !currentLocation) return;

    const service = new window.google.maps.places.PlacesService(googleMapRef.current);
    const config = PLACE_TYPES[category];

    const request = {
      location: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng),
      radius: 10000,
      keyword: config.keyword,
    };

    service.nearbySearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const places = results.map((place) => {
          const distance = calculateDistance(
            currentLocation.lat, currentLocation.lng,
            place.geometry.location.lat(), place.geometry.location.lng()
          );
          return {
            id: place.place_id,
            name: place.name,
            address: place.vicinity,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            distance,
            rating: place.rating,
            isOpen: place.opening_hours?.isOpen?.(),
            phone: place.formatted_phone_number,
          };
        }).sort((a, b) => a.distance - b.distance);

        setNearbyPlaces(places);
        updateMapMarkers(places, category);
      } else {
        // Fallback to Overpass
        searchWithOverpass(category);
      }
      setSearchingPlaces(false);
    });
  }, [currentLocation]);

  // Search with OpenStreetMap Overpass API
  const searchWithOverpass = useCallback(async (category) => {
    if (!currentLocation) return;

    const config = PLACE_TYPES[category];
    let amenityQuery = '';
    
    if (category === 'barracks') {
      amenityQuery = `node[military](around:15000,${currentLocation.lat},${currentLocation.lng});
                      way[military](around:15000,${currentLocation.lat},${currentLocation.lng});
                      node[landuse=military](around:15000,${currentLocation.lat},${currentLocation.lng});`;
    } else {
      amenityQuery = `node[amenity=${config.overpassAmenity}](around:10000,${currentLocation.lat},${currentLocation.lng});
                      way[amenity=${config.overpassAmenity}](around:10000,${currentLocation.lat},${currentLocation.lng});`;
    }

    const query = `[out:json][timeout:25];(${amenityQuery});out center;`;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });
      const data = await response.json();

      const places = data.elements
        .map((el, index) => {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          if (!lat || !lng) return null;

          const distance = calculateDistance(currentLocation.lat, currentLocation.lng, lat, lng);
          return {
            id: el.id || `osm-${index}`,
            name: el.tags?.name || `${config.label} ${index + 1}`,
            address: el.tags?.['addr:street'] || el.tags?.['addr:full'] || 'Address not available',
            lat,
            lng,
            distance,
            phone: el.tags?.phone || el.tags?.['contact:phone'],
          };
        })
        .filter((p) => p !== null)
        .sort((a, b) => a.distance - b.distance);

      setNearbyPlaces(places);
      updateMapMarkers(places, category);
    } catch (error) {
      console.error('Overpass search error:', error);
      setNearbyPlaces([]);
    }
    setSearchingPlaces(false);
  }, [currentLocation]);

  // Update map markers
  const updateMapMarkers = useCallback((places, category) => {
    // Clear existing markers
    markersRef.current.forEach((marker) => {
      if (marker.setMap) marker.setMap(null); // Google
      if (marker.remove) marker.remove(); // Leaflet
    });
    markersRef.current = [];

    const config = PLACE_TYPES[category];

    if (mapProvider === 'google' && googleMapRef.current) {
      places.forEach((place) => {
        const marker = new window.google.maps.Marker({
          position: { lat: place.lat, lng: place.lng },
          map: googleMapRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: config.color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          title: place.name,
        });

        marker.addListener('click', () => setSelectedPlace(place));
        markersRef.current.push(marker);
      });
    } else if (leafletMapRef.current) {
      const L = window.L;
      places.forEach((place) => {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${config.color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([place.lat, place.lng], { icon })
          .addTo(leafletMapRef.current)
          .bindPopup(`<b>${place.name}</b><br>${place.address}`);

        marker.on('click', () => setSelectedPlace(place));
        markersRef.current.push(marker);
      });
    }
  }, [mapProvider]);

  // Calculate distance
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Format distance
  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Get direction name
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

  // Search places when category changes
  useEffect(() => {
    if (!currentLocation) return;

    setSearchingPlaces(true);
    
    if (mapProvider === 'google' && googleMapRef.current) {
      searchWithGoogle(selectedCategory);
    } else {
      searchWithOverpass(selectedCategory);
    }
  }, [selectedCategory, currentLocation, mapProvider, searchWithGoogle, searchWithOverpass]);

  // Navigate to place
  const navigateToPlace = (place) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`,
      '_blank'
    );
  };

  // Call place
  const callPlace = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  // Share location
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
        longitude: currentLocation.lng,
      });

      alert('Location shared with your trusted contacts!');
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share location. Please try again.');
    } finally {
      setSharingLocation(false);
    }
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

        <Dialog open={showOfflineManager} onOpenChange={setShowOfflineManager}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-zinc-700">
              <Download className="w-4 h-4 mr-2" />
              Offline Maps
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapIcon className="w-5 h-5" />
                Offline Map Manager
              </DialogTitle>
            </DialogHeader>
            <OfflineMapManager />
          </DialogContent>
        </Dialog>
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
                {currentLocation
                  ? `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`
                  : 'Getting location...'}
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
            <Button variant="outline" size="sm" onClick={requestCompassPermission} className="text-xs">
              Enable Compass
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full border-2 border-zinc-700 bg-zinc-800/50" />
            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-tg-danger">N</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-500">S</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">W</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">E</span>
            <div
              className="absolute inset-4 flex items-center justify-center transition-transform duration-300"
              style={{ transform: `rotate(${compassHeading}deg)` }}
            >
              <div className="w-1 h-full bg-gradient-to-b from-tg-danger to-zinc-600 rounded-full" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-zinc-600" />
          </div>

          <div className="ml-6 text-center">
            <p className="text-3xl font-bold">{compassHeading}°</p>
            <p className="text-sm text-zinc-500">{getDirectionName(compassHeading)}</p>
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

      {/* Map Provider Toggle */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Map: {mapProvider === 'google' ? 'Google Maps' : 'OpenStreetMap'}</span>
        {isGoogleMapsKeyValid && (
          <button
            onClick={() => setMapProvider(mapProvider === 'google' ? 'leaflet' : 'google')}
            className="text-tg-safe hover:underline"
          >
            Switch to {mapProvider === 'google' ? 'OpenStreetMap' : 'Google Maps'}
          </button>
        )}
      </div>

      {/* Map Container */}
      <div className="tg-card p-2 overflow-hidden" style={{ height: '320px' }}>
        <div
          ref={mapContainerRef}
          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
        />
      </div>

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
            onClick={() => {
              setSearchingPlaces(true);
              if (mapProvider === 'google' && googleMapRef.current) {
                searchWithGoogle(selectedCategory);
              } else {
                searchWithOverpass(selectedCategory);
              }
            }}
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
                      {place.rating && <span>⭐ {place.rating}</span>}
                      {place.isOpen !== undefined && (
                        <span className={place.isOpen ? 'text-tg-safe' : 'text-tg-danger'}>
                          {place.isOpen ? 'Open' : 'Closed'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {place.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-zinc-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          callPlace(place.phone);
                        }}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-8 bg-tg-safe hover:bg-tg-safe/90 text-black"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToPlace(place);
                      }}
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
          <a href="tel:112" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50">
            <p className="text-lg font-bold">112</p>
            <p className="text-xs text-zinc-500">Emergency</p>
          </a>
          <a href="tel:199" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50">
            <p className="text-lg font-bold">199</p>
            <p className="text-xs text-zinc-500">Police</p>
          </a>
          <a href="tel:767" className="p-3 bg-zinc-800/50 rounded-xl text-center hover:bg-zinc-700/50">
            <p className="text-lg font-bold">767</p>
            <p className="text-xs text-zinc-500">LASEMA</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default FindSafety;
