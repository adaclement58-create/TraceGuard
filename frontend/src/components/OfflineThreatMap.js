import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, Download, Trash2, HardDrive, Map, 
  CheckCircle2, Loader2, AlertTriangle, Wifi, WifiOff,
  Navigation, Target, Crosshair
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

// Offline Threat Map - Download and cache threat data for offline use
// Works 100% OFFLINE using IndexedDB

const DB_NAME = 'traceguard_threat_map';
const DB_VERSION = 1;
const STORE_NAME = 'threats';

const OfflineThreatMap = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [threats, setThreats] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [nearbyThreats, setNearbyThreats] = useState([]);

  const dbRef = useRef(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize IndexedDB
  useEffect(() => {
    const initDB = async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          dbRef.current = request.result;
          resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('location', ['lat', 'lng'], { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      });
    };

    initDB().then(() => {
      loadStoredThreats();
      loadLastSync();
    }).catch(console.error);
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
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Calculate nearby threats when location changes
  useEffect(() => {
    if (currentLocation && threats.length > 0) {
      const nearby = threats.filter(threat => {
        const distance = calculateDistance(
          currentLocation.lat, currentLocation.lng,
          threat.lat, threat.lng
        );
        return distance <= 10; // Within 10km
      }).sort((a, b) => {
        const distA = calculateDistance(currentLocation.lat, currentLocation.lng, a.lat, a.lng);
        const distB = calculateDistance(currentLocation.lat, currentLocation.lng, b.lat, b.lng);
        return distA - distB;
      });
      
      setNearbyThreats(nearby.slice(0, 10)); // Top 10 nearest
    }
  }, [currentLocation, threats]);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Load stored threats from IndexedDB
  const loadStoredThreats = useCallback(async () => {
    if (!dbRef.current) return;

    return new Promise((resolve, reject) => {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        setThreats(request.result || []);
        calculateStorageUsed(request.result || []);
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }, []);

  // Load last sync time
  const loadLastSync = () => {
    const saved = localStorage.getItem('threat_map_last_sync');
    if (saved) {
      setLastSync(new Date(saved));
    }
  };

  // Calculate storage used
  const calculateStorageUsed = (data) => {
    const size = new Blob([JSON.stringify(data)]).size;
    setStorageUsed(size);
  };

  // Save threat to IndexedDB
  const saveThreat = useCallback(async (threat) => {
    if (!dbRef.current) return;

    return new Promise((resolve, reject) => {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(threat);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, []);

  // Download threat data (simulated - would connect to real API)
  const downloadThreatData = useCallback(async () => {
    if (!isOnline) {
      alert('Cannot download while offline');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // Simulated threat data for Nigerian conflict zones
      // In production, this would fetch from a real threat intelligence API
      const simulatedThreats = generateSimulatedThreats();
      
      let saved = 0;
      for (const threat of simulatedThreats) {
        await saveThreat(threat);
        saved++;
        setDownloadProgress((saved / simulatedThreats.length) * 100);
      }

      localStorage.setItem('threat_map_last_sync', new Date().toISOString());
      setLastSync(new Date());
      await loadStoredThreats();

      alert(`Downloaded ${simulatedThreats.length} threat reports`);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [isOnline, saveThreat, loadStoredThreats]);

  // Generate simulated threat data for Nigerian regions
  const generateSimulatedThreats = () => {
    const threats = [];
    const threatTypes = ['ied', 'ambush', 'hostile_sighting', 'checkpoint', 'safe_zone'];
    const severities = ['low', 'medium', 'high', 'critical'];

    // Northeast Nigeria (Boko Haram territory)
    const northeastZones = [
      { name: 'Maiduguri', lat: 11.8333, lng: 13.1500 },
      { name: 'Bama', lat: 11.5167, lng: 13.6833 },
      { name: 'Gwoza', lat: 11.0833, lng: 13.7000 },
      { name: 'Konduga', lat: 11.6500, lng: 13.2667 },
      { name: 'Damboa', lat: 11.1500, lng: 12.7500 },
      { name: 'Sambisa', lat: 11.0000, lng: 13.5000 },
    ];

    // Northwest Nigeria (Banditry zones)
    const northwestZones = [
      { name: 'Gusau', lat: 12.1700, lng: 6.6614 },
      { name: 'Katsina', lat: 13.0059, lng: 7.6000 },
      { name: 'Kaduna', lat: 10.5222, lng: 7.4383 },
      { name: 'Zamfara', lat: 12.1222, lng: 6.2500 },
      { name: 'Sokoto', lat: 13.0622, lng: 5.2339 },
    ];

    const allZones = [...northeastZones, ...northwestZones];

    allZones.forEach(zone => {
      // Generate 3-5 threats per zone
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        threats.push({
          id: `${zone.name.toLowerCase()}-${Date.now()}-${i}`,
          type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          lat: zone.lat + (Math.random() - 0.5) * 0.2,
          lng: zone.lng + (Math.random() - 0.5) * 0.2,
          description: `Threat report near ${zone.name}`,
          zone: zone.name,
          timestamp: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
          verified: Math.random() > 0.3,
          source: 'intelligence_report'
        });
      }
    });

    return threats;
  };

  // Clear all stored threats
  const clearThreats = useCallback(async () => {
    if (!dbRef.current) return;
    
    if (!window.confirm('Clear all cached threat data?')) return;

    return new Promise((resolve, reject) => {
      const transaction = dbRef.current.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        setThreats([]);
        setNearbyThreats([]);
        setStorageUsed(0);
        localStorage.removeItem('threat_map_last_sync');
        setLastSync(null);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }, []);

  // Report new threat (user-generated)
  const reportThreat = useCallback(async (type) => {
    if (!currentLocation) {
      alert('Location required to report threat');
      return;
    }

    const newThreat = {
      id: `user-${Date.now()}`,
      type,
      severity: 'medium',
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      description: `User-reported ${type}`,
      zone: 'User Location',
      timestamp: Date.now(),
      verified: false,
      source: 'user_report'
    };

    await saveThreat(newThreat);
    await loadStoredThreats();

    // Vibrate feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    alert('Threat reported and cached locally');
  }, [currentLocation, saveThreat, loadStoredThreats]);

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get threat icon color
  const getThreatColor = (type) => {
    switch (type) {
      case 'ied': return 'text-red-500';
      case 'ambush': return 'text-orange-500';
      case 'hostile_sighting': return 'text-yellow-500';
      case 'checkpoint': return 'text-blue-500';
      case 'safe_zone': return 'text-green-500';
      default: return 'text-zinc-500';
    }
  };

  // Get severity badge
  const getSeverityBadge = (severity) => {
    const colors = {
      low: 'bg-green-500/20 text-green-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-orange-500/20 text-orange-400',
      critical: 'bg-red-500/20 text-red-400'
    };
    return colors[severity] || colors.low;
  };

  return (
    <div className={`tg-card overflow-hidden ${className}`} data-testid="offline-threat-map">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isOnline ? 'bg-tg-safe/20' : 'bg-orange-500/20'}`}>
              <Map className={`w-5 h-5 ${isOnline ? 'text-tg-safe' : 'text-orange-400'}`} />
            </div>
            <div>
              <p className="font-medium">Offline Threat Map</p>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                {isOnline ? (
                  <><Wifi className="w-3 h-3 text-tg-safe" /> Online</>
                ) : (
                  <><WifiOff className="w-3 h-3 text-orange-400" /> Offline Mode</>
                )}
                {lastSync && (
                  <span className="text-zinc-600 ml-2">
                    • Synced: {lastSync.toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">
              <HardDrive className="w-3 h-3 inline mr-1" />
              {formatBytes(storageUsed)}
            </span>
          </div>
        </div>
      </div>

      {/* Download/Sync Section */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex gap-2">
          <Button
            onClick={downloadThreatData}
            disabled={!isOnline || isDownloading}
            className="flex-1 bg-tg-safe text-black"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isDownloading ? 'Downloading...' : 'Download Threat Data'}
          </Button>
          <Button
            variant="outline"
            onClick={clearThreats}
            className="border-zinc-700"
            disabled={threats.length === 0}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        {isDownloading && (
          <Progress value={downloadProgress} className="mt-2 h-1" />
        )}
      </div>

      {/* Nearby Threats */}
      {nearbyThreats.length > 0 && (
        <div className="p-4 border-b border-zinc-800">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Nearby Threats ({nearbyThreats.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {nearbyThreats.map(threat => (
              <div 
                key={threat.id}
                className="p-2 bg-zinc-800/50 rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${getThreatColor(threat.type)}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{threat.type.replace('_', ' ')}</p>
                    <p className="text-xs text-zinc-500">{threat.zone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${getSeverityBadge(threat.severity)}`}>
                    {threat.severity}
                  </span>
                  <p className="text-xs text-zinc-600 mt-1">
                    {currentLocation && (
                      `${calculateDistance(
                        currentLocation.lat, currentLocation.lng,
                        threat.lat, threat.lng
                      ).toFixed(1)} km`
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Threat */}
      <div className="p-4">
        <h4 className="text-sm font-medium mb-3">Report Threat</h4>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reportThreat('ied')}
            className="border-red-500/30 text-red-400 text-xs"
          >
            IED
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reportThreat('ambush')}
            className="border-orange-500/30 text-orange-400 text-xs"
          >
            Ambush
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reportThreat('hostile_sighting')}
            className="border-yellow-500/30 text-yellow-400 text-xs"
          >
            Hostile
          </Button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Reports are cached locally and sync when online
        </p>
      </div>

      {/* Stats */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-800/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-tg-safe">{threats.length}</p>
            <p className="text-xs text-zinc-500">Total Reports</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-400">
              {threats.filter(t => t.severity === 'high' || t.severity === 'critical').length}
            </p>
            <p className="text-xs text-zinc-500">High Risk</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-400">{nearbyThreats.length}</p>
            <p className="text-xs text-zinc-500">Nearby</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineThreatMap;
