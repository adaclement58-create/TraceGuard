import { useEffect, useRef, useCallback } from 'react';

// Hook for tracking and reporting live location during active incidents
export const useLiveLocationTracker = ({
  api,
  incidentId,
  isActive = false,
  intervalMs = 30000 // 30 seconds default
}) => {
  const watchIdRef = useRef(null);
  const intervalIdRef = useRef(null);

  const sendLocationPing = useCallback(async (position) => {
    if (!incidentId || !api) return;

    try {
      await api.post('/location/ping', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        battery: await getBatteryLevel(),
        network: navigator.onLine ? 'online' : 'offline',
        incident_id: incidentId
      });
      console.log('Location ping sent');
    } catch (error) {
      console.error('Failed to send location ping:', error);
    }
  }, [api, incidentId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    // Watch position for continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        sendLocationPing(position);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    // Also send periodic pings at fixed intervals
    intervalIdRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        sendLocationPing,
        (error) => console.error('Periodic location error:', error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, intervalMs);

  }, [sendLocationPing, intervalMs]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isActive && incidentId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [isActive, incidentId, startTracking, stopTracking]);

  return { startTracking, stopTracking };
};

// Hook for periodically updating user location (background)
export const useLocationReporter = ({
  api,
  enabled = true,
  intervalMs = 60000 // 1 minute default
}) => {
  const intervalIdRef = useRef(null);

  const updateLocation = useCallback(async () => {
    if (!api || !navigator.geolocation) return;

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      await api.put('/location/update', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        battery: await getBatteryLevel()
      });
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, [api]);

  useEffect(() => {
    if (enabled) {
      // Initial update
      updateLocation();
      
      // Periodic updates
      intervalIdRef.current = setInterval(updateLocation, intervalMs);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [enabled, intervalMs, updateLocation]);

  return { updateLocation };
};

// Hook for monitoring geofence zones
export const useGeofenceMonitor = ({
  api,
  zones = [],
  enabled = true
}) => {
  const lastEventRef = useRef({});
  const watchIdRef = useRef(null);

  const checkGeofences = useCallback(async (position) => {
    if (!api || zones.length === 0) return;

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    for (const zone of zones) {
      if (!zone.is_active) continue;

      const distance = calculateDistance(
        userLat, userLng,
        zone.latitude, zone.longitude
      );

      const isInside = distance <= zone.radius;
      const wasInside = lastEventRef.current[zone.id] === 'enter';

      if (isInside && !wasInside) {
        // Entered zone
        lastEventRef.current[zone.id] = 'enter';
        if (zone.notify_on_enter) {
          try {
            await api.post(`/safe-zones/geofence-alert?zone_id=${zone.id}&event_type=enter`);
          } catch (error) {
            console.error('Failed to send enter alert:', error);
          }
        }
      } else if (!isInside && wasInside) {
        // Exited zone
        lastEventRef.current[zone.id] = 'exit';
        if (zone.notify_on_exit) {
          try {
            await api.post(`/safe-zones/geofence-alert?zone_id=${zone.id}&event_type=exit`);
          } catch (error) {
            console.error('Failed to send exit alert:', error);
          }
        }
      }
    }
  }, [api, zones]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation || zones.length === 0) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      checkGeofences,
      (error) => console.error('Geofence watch error:', error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, zones, checkGeofences]);
};

// Hook for offline SOS queue
export const useOfflineSOS = ({ api }) => {
  const QUEUE_KEY = 'traceguard_offline_sos';

  const queueSOS = useCallback((sosData) => {
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      queue.push({
        ...sosData,
        queued_at: new Date().toISOString()
      });
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log('SOS queued for offline sync');
    } catch (error) {
      console.error('Failed to queue SOS:', error);
    }
  }, []);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine || !api) return;

    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if (queue.length === 0) return;

      for (const sos of queue) {
        try {
          await api.post('/incidents', {
            incident_type: sos.incident_type || 'sos',
            severity: sos.severity || 'high',
            latitude: sos.latitude,
            longitude: sos.longitude
          });
          console.log('Offline SOS synced');
        } catch (error) {
          console.error('Failed to sync offline SOS:', error);
        }
      }

      // Clear queue after successful sync
      localStorage.removeItem(QUEUE_KEY);
    } catch (error) {
      console.error('Failed to flush offline queue:', error);
    }
  }, [api]);

  // Auto-flush when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online, flushing SOS queue...');
      flushQueue();
    };

    window.addEventListener('online', handleOnline);
    
    // Also try to flush on mount if online
    if (navigator.onLine) {
      flushQueue();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [flushQueue]);

  return { queueSOS, flushQueue };
};

// Helper functions
async function getBatteryLevel() {
  try {
    if ('getBattery' in navigator) {
      const battery = await navigator.getBattery();
      return Math.round(battery.level * 100);
    }
  } catch (error) {
    console.warn('Battery API not available');
  }
  return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

export default useLiveLocationTracker;
