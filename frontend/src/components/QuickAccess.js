import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Hospital, Navigation, Phone, Loader2, MapPin, Building2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const QuickAccess = ({ className = '' }) => {
  const { userLocation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nearestPolice, setNearestPolice] = useState(null);
  const [nearestHospital, setNearestHospital] = useState(null);
  const [nearestBarracks, setNearestBarracks] = useState(null);
  const [error, setError] = useState(null);

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

  // Search for nearby places using Google Places API
  const searchNearbyPlaces = useCallback(async (latitude, longitude) => {
    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => searchWithGooglePlaces(latitude, longitude);
      document.head.appendChild(script);
    } else {
      searchWithGooglePlaces(latitude, longitude);
    }
  }, []);

  const searchWithGooglePlaces = (latitude, longitude) => {
    // Create a hidden map element for Places service
    const mapDiv = document.createElement('div');
    mapDiv.style.display = 'none';
    document.body.appendChild(mapDiv);
    
    const map = new window.google.maps.Map(mapDiv, {
      center: { lat: latitude, lng: longitude },
      zoom: 15
    });
    
    const service = new window.google.maps.places.PlacesService(map);
    const location = new window.google.maps.LatLng(latitude, longitude);
    
    // Search for police
    service.nearbySearch({
      location,
      radius: 10000,
      keyword: 'police station'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        const nearest = results.reduce((closest, place) => {
          const distance = calculateDistance(
            latitude, longitude,
            place.geometry.location.lat(), place.geometry.location.lng()
          );
          if (!closest || distance < closest.distance) {
            return {
              name: place.name,
              address: place.vicinity,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              distance,
              phone: '112' // Default emergency number
            };
          }
          return closest;
        }, null);
        setNearestPolice(nearest);
      }
    });
    
    // Search for hospitals
    service.nearbySearch({
      location,
      radius: 10000,
      type: 'hospital'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        const nearest = results.reduce((closest, place) => {
          const distance = calculateDistance(
            latitude, longitude,
            place.geometry.location.lat(), place.geometry.location.lng()
          );
          if (!closest || distance < closest.distance) {
            return {
              name: place.name,
              address: place.vicinity,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              distance,
              phone: '767' // Default emergency number
            };
          }
          return closest;
        }, null);
        setNearestHospital(nearest);
      }
      setLoading(false);
    });
    
    // Search for military/barracks
    service.nearbySearch({
      location,
      radius: 15000,
      keyword: 'military barracks army'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        const nearest = results.reduce((closest, place) => {
          const distance = calculateDistance(
            latitude, longitude,
            place.geometry.location.lat(), place.geometry.location.lng()
          );
          if (!closest || distance < closest.distance) {
            return {
              name: place.name,
              address: place.vicinity,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              distance
            };
          }
          return closest;
        }, null);
        setNearestBarracks(nearest);
      }
    });
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(mapDiv);
    }, 5000);
  };

  // Fallback to Overpass API
  const searchWithOverpass = async (latitude, longitude) => {
    try {
      // Search for police
      const policeQuery = `
        [out:json][timeout:10];
        node[amenity=police](around:10000,${latitude},${longitude});
        out 1;
      `;
      
      const policeRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: policeQuery
      });
      const policeData = await policeRes.json();
      
      if (policeData.elements.length > 0) {
        const el = policeData.elements[0];
        setNearestPolice({
          name: el.tags?.name || 'Police Station',
          address: el.tags?.['addr:street'] || 'Nearby',
          lat: el.lat,
          lng: el.lon,
          distance: calculateDistance(latitude, longitude, el.lat, el.lon),
          phone: el.tags?.phone || '112'
        });
      }

      // Search for hospitals
      const hospitalQuery = `
        [out:json][timeout:10];
        node[amenity=hospital](around:10000,${latitude},${longitude});
        out 1;
      `;
      
      const hospitalRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: hospitalQuery
      });
      const hospitalData = await hospitalRes.json();
      
      if (hospitalData.elements.length > 0) {
        const el = hospitalData.elements[0];
        setNearestHospital({
          name: el.tags?.name || 'Hospital',
          address: el.tags?.['addr:street'] || 'Nearby',
          lat: el.lat,
          lng: el.lon,
          distance: calculateDistance(latitude, longitude, el.lat, el.lon),
          phone: el.tags?.phone || '767'
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Overpass API error:', error);
      setError('Could not find nearby places');
      setLoading(false);
    }
  };

  // Get location and search for places
  useEffect(() => {
    const getLocationAndSearch = async () => {
      let latitude, longitude;
      
      if (userLocation) {
        latitude = userLocation.latitude;
        longitude = userLocation.longitude;
      } else if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (error) {
          console.error('Location error:', error);
          setError('Location access required');
          setLoading(false);
          return;
        }
      } else {
        setError('Geolocation not supported');
        setLoading(false);
        return;
      }

      // Try Google Places first, fallback to Overpass
      if (GOOGLE_MAPS_API_KEY) {
        searchNearbyPlaces(latitude, longitude);
      } else {
        searchWithOverpass(latitude, longitude);
      }
    };

    getLocationAndSearch();
  }, [userLocation, searchNearbyPlaces]);

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

  if (error) {
    return (
      <div className={`tg-card p-4 ${className}`}>
        <div className="text-center py-4 text-zinc-500">
          <MapPin className="w-6 h-6 mx-auto mb-2" />
          <p>{error}</p>
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
            <p className="text-xs text-zinc-500 mb-2 truncate">{nearestPolice.address}</p>
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
            <p className="text-xs text-zinc-500 mb-2 truncate">{nearestHospital.address}</p>
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

      {/* Nearest Barracks (if available) */}
      {nearestBarracks && (
        <div 
          className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl"
          data-testid="nearest-barracks"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-green-400">Military/Barracks</span>
            </div>
            {nearestBarracks.distance && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {formatDistance(nearestBarracks.distance)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium truncate">{nearestBarracks.name}</p>
          <p className="text-xs text-zinc-500 mb-2 truncate">{nearestBarracks.address}</p>
          <Button
            size="sm"
            className="w-full h-8 text-xs bg-green-500 hover:bg-green-600 text-white"
            onClick={() => navigateTo(nearestBarracks.lat, nearestBarracks.lng)}
          >
            <Navigation className="w-3 h-3 mr-1" />
            Navigate
          </Button>
        </div>
      )}

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
