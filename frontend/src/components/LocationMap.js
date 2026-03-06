import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const safeIcon = createCustomIcon('#10b981');
const dangerIcon = createCustomIcon('#ef4444');
const warningIcon = createCustomIcon('#f59e0b');
const neutralIcon = createCustomIcon('#64748b');

// Dark map tile layer (CartoDB Dark Matter)
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Nigeria center coordinates
const NIGERIA_CENTER = [9.0765, 7.3986];
const DEFAULT_ZOOM = 6;

export const LocationMap = ({ 
  center = NIGERIA_CENTER, 
  zoom = DEFAULT_ZOOM, 
  markers = [], 
  path = [],
  zones = [],
  height = '400px',
  className = ''
}) => {
  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={DARK_TILE_ATTRIBUTION}
          url={DARK_TILE_URL}
        />
        
        {/* Safe Zones as circles */}
        {zones.map((zone, index) => (
          <Circle
            key={zone.id || index}
            center={[zone.latitude, zone.longitude]}
            radius={zone.radius}
            pathOptions={{
              color: zone.zone_type === 'home' ? '#10b981' : 
                     zone.zone_type === 'work' ? '#f59e0b' : 
                     zone.zone_type === 'school' ? '#3b82f6' : '#a855f7',
              fillColor: zone.zone_type === 'home' ? '#10b981' : 
                         zone.zone_type === 'work' ? '#f59e0b' : 
                         zone.zone_type === 'school' ? '#3b82f6' : '#a855f7',
              fillOpacity: 0.2,
              weight: 2
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{zone.name}</strong>
                <br />
                <span className="capitalize">{zone.zone_type}</span>
                <br />
                Radius: {zone.radius}m
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Location path/trail */}
        {path.length > 1 && (
          <Polyline
            positions={path.map(p => [p.latitude, p.longitude])}
            pathOptions={{
              color: '#ef4444',
              weight: 3,
              opacity: 0.8,
              dashArray: '10, 5'
            }}
          />
        )}

        {/* Markers */}
        {markers.map((marker, index) => {
          const icon = marker.status === 'safe' ? safeIcon :
                       marker.status === 'danger' || marker.status === 'sos_active' ? dangerIcon :
                       marker.status === 'warning' || marker.status === 'trip_active' ? warningIcon :
                       neutralIcon;
          
          return (
            <Marker
              key={marker.id || index}
              position={[marker.latitude, marker.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="text-sm min-w-[150px]">
                  {marker.name && <strong className="block mb-1">{marker.name}</strong>}
                  {marker.email && <span className="text-gray-600 text-xs block">{marker.email}</span>}
                  {marker.status && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      marker.status === 'safe' ? 'bg-green-100 text-green-800' :
                      marker.status === 'sos_active' ? 'bg-red-100 text-red-800' :
                      marker.status === 'trip_active' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {marker.status.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {marker.timestamp && (
                    <span className="text-gray-500 text-xs block mt-1">
                      {new Date(marker.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  {marker.battery && (
                    <span className="text-gray-500 text-xs block">
                      Battery: {marker.battery}%
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export const IncidentMap = ({ incident, pings = [] }) => {
  if (!incident?.last_known_lat) {
    return (
      <div className="h-64 bg-zinc-800 rounded-xl flex items-center justify-center">
        <p className="text-zinc-500">No location data available</p>
      </div>
    );
  }

  const center = [incident.last_known_lat, incident.last_known_lng];
  const markers = [
    {
      id: 'current',
      latitude: incident.last_known_lat,
      longitude: incident.last_known_lng,
      name: incident.owner_name || 'Current Location',
      status: incident.status === 'active' ? 'danger' : 'safe',
      timestamp: incident.created_at
    }
  ];

  // Add ping trail markers
  const pingMarkers = pings.map((ping, index) => ({
    id: ping.id || `ping-${index}`,
    latitude: ping.latitude,
    longitude: ping.longitude,
    status: 'neutral',
    timestamp: ping.timestamp,
    battery: ping.battery
  }));

  return (
    <LocationMap
      center={center}
      zoom={15}
      markers={[...markers, ...pingMarkers]}
      path={pings}
      height="300px"
    />
  );
};

export const FamilyMap = ({ members = [] }) => {
  const validMembers = members.filter(m => m.location?.latitude && m.location?.longitude);
  
  if (validMembers.length === 0) {
    return (
      <div className="h-64 bg-zinc-800 rounded-xl flex items-center justify-center">
        <p className="text-zinc-500">No location data available for family members</p>
      </div>
    );
  }

  const markers = validMembers.map(member => ({
    id: member.email,
    latitude: member.location.latitude,
    longitude: member.location.longitude,
    name: member.full_name || member.email,
    email: member.email,
    status: member.status || 'safe',
    timestamp: member.location.updated_at
  }));

  // Center on first member with location
  const center = [validMembers[0].location.latitude, validMembers[0].location.longitude];

  return (
    <LocationMap
      center={center}
      zoom={12}
      markers={markers}
      height="400px"
    />
  );
};

export const SafeZonesMap = ({ zones = [], userLocation = null }) => {
  const center = userLocation 
    ? [userLocation.latitude, userLocation.longitude]
    : zones.length > 0 
      ? [zones[0].latitude, zones[0].longitude]
      : NIGERIA_CENTER;

  const markers = userLocation ? [{
    id: 'user',
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    name: 'Your Location',
    status: 'safe'
  }] : [];

  return (
    <LocationMap
      center={center}
      zoom={13}
      markers={markers}
      zones={zones}
      height="300px"
    />
  );
};

export default LocationMap;
