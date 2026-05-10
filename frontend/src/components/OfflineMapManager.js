import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Download, Trash2, MapPin, Loader2, CheckCircle2, 
  AlertTriangle, Wifi, WifiOff, HardDrive, Map
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

// Offline map storage using IndexedDB
const DB_NAME = 'traceguard-maps';
const DB_VERSION = 1;
const TILE_STORE = 'map-tiles';
const REGIONS_STORE = 'cached-regions';

// Nigerian cities/regions for pre-caching
const NIGERIAN_REGIONS = [
  { id: 'lagos', name: 'Lagos', center: { lat: 6.5244, lng: 3.3792 }, zoom: 12 },
  { id: 'abuja', name: 'Abuja', center: { lat: 9.0579, lng: 7.4951 }, zoom: 12 },
  { id: 'port-harcourt', name: 'Port Harcourt', center: { lat: 4.8156, lng: 7.0498 }, zoom: 12 },
  { id: 'kano', name: 'Kano', center: { lat: 12.0022, lng: 8.5920 }, zoom: 12 },
  { id: 'ibadan', name: 'Ibadan', center: { lat: 7.3775, lng: 3.9470 }, zoom: 12 },
];

// Tile URL templates
const TILE_PROVIDERS = {
  cartoDark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

class OfflineMapDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store for map tiles
        if (!db.objectStoreNames.contains(TILE_STORE)) {
          const tileStore = db.createObjectStore(TILE_STORE, { keyPath: 'url' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Store for cached regions metadata
        if (!db.objectStoreNames.contains(REGIONS_STORE)) {
          db.createObjectStore(REGIONS_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  async saveTile(url, blob) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readwrite');
      const store = transaction.objectStore(TILE_STORE);
      
      const request = store.put({
        url,
        blob,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getTile(url) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readonly');
      const store = transaction.objectStore(TILE_STORE);
      const request = store.get(url);
      
      request.onsuccess = () => resolve(request.result?.blob);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRegion(region) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([REGIONS_STORE], 'readwrite');
      const store = transaction.objectStore(REGIONS_STORE);
      
      const request = store.put(region);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getRegions() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([REGIONS_STORE], 'readonly');
      const store = transaction.objectStore(REGIONS_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRegion(regionId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([REGIONS_STORE], 'readwrite');
      const store = transaction.objectStore(REGIONS_STORE);
      const request = store.delete(regionId);
      
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE], 'readonly');
      const store = transaction.objectStore(TILE_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const tiles = request.result || [];
        const totalBytes = tiles.reduce((sum, tile) => {
          return sum + (tile.blob?.size || 0);
        }, 0);
        resolve(totalBytes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([TILE_STORE, REGIONS_STORE], 'readwrite');
      
      transaction.objectStore(TILE_STORE).clear();
      transaction.objectStore(REGIONS_STORE).clear();
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Helper functions for tile calculations
function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

function getTilesForRegion(center, zoom, radiusKm = 5) {
  const tiles = [];
  const subdomains = ['a', 'b', 'c'];
  
  // Calculate bounds
  const latDelta = radiusKm / 111; // ~111km per degree latitude
  const lngDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));
  
  const north = center.lat + latDelta;
  const south = center.lat - latDelta;
  const east = center.lng + lngDelta;
  const west = center.lng - lngDelta;
  
  // Get tiles for multiple zoom levels (for smooth zooming)
  const zoomLevels = [zoom - 2, zoom - 1, zoom, zoom + 1, zoom + 2].filter(z => z >= 1 && z <= 18);
  
  for (const z of zoomLevels) {
    const minX = lon2tile(west, z);
    const maxX = lon2tile(east, z);
    const minY = lat2tile(north, z);
    const maxY = lat2tile(south, z);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const subdomain = subdomains[(x + y) % 3];
        const url = TILE_PROVIDERS.cartoDark
          .replace('{s}', subdomain)
          .replace('{z}', z.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString())
          .replace('{r}', '');
        tiles.push(url);
      }
    }
  }
  
  return tiles;
}

// Main component
const OfflineMapManager = ({ className = '' }) => {
  const [db] = useState(() => new OfflineMapDB());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedRegions, setCachedRegions] = useState([]);
  const [storageSize, setStorageSize] = useState(0);
  const [downloading, setDownloading] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Initialize and load cached regions
  useEffect(() => {
    const init = async () => {
      try {
        await db.init();
        const regions = await db.getRegions();
        setCachedRegions(regions);
        const size = await db.getStorageSize();
        setStorageSize(size);
      } catch (err) {
        console.error('Failed to init offline maps DB:', err);
      }
    };
    init();

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [db]);

  // Download region for offline use
  const downloadRegion = useCallback(async (region) => {
    if (downloading) return;
    
    setDownloading(region.id);
    setDownloadProgress(0);
    setError(null);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const tiles = getTilesForRegion(region.center, region.zoom);
      const totalTiles = tiles.length;
      let downloadedTiles = 0;
      let failedTiles = 0;
      
      // Download in batches to avoid overwhelming the browser
      const batchSize = 10;
      for (let i = 0; i < tiles.length; i += batchSize) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Download cancelled');
        }
        
        const batch = tiles.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (url) => {
          try {
            const response = await fetch(url, {
              signal: abortControllerRef.current?.signal
            });
            
            if (response.ok) {
              const blob = await response.blob();
              await db.saveTile(url, blob);
              downloadedTiles++;
            } else {
              failedTiles++;
            }
          } catch (err) {
            if (err.name !== 'AbortError') {
              failedTiles++;
            }
          }
        }));
        
        setDownloadProgress(Math.round((downloadedTiles / totalTiles) * 100));
      }
      
      // Save region metadata
      const regionData = {
        ...region,
        downloadedAt: new Date().toISOString(),
        tilesCount: downloadedTiles,
        failedCount: failedTiles
      };
      
      await db.saveRegion(regionData);
      
      // Update state
      const regions = await db.getRegions();
      setCachedRegions(regions);
      const size = await db.getStorageSize();
      setStorageSize(size);
      
    } catch (err) {
      if (err.message !== 'Download cancelled') {
        setError(`Failed to download ${region.name}: ${err.message}`);
      }
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
      abortControllerRef.current = null;
    }
  }, [db, downloading]);

  // Cancel download
  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Delete cached region
  const deleteRegion = useCallback(async (regionId) => {
    try {
      await db.deleteRegion(regionId);
      const regions = await db.getRegions();
      setCachedRegions(regions);
      const size = await db.getStorageSize();
      setStorageSize(size);
    } catch (err) {
      setError(`Failed to delete region: ${err.message}`);
    }
  }, [db]);

  // Clear all cached data
  const clearAllCache = useCallback(async () => {
    if (!window.confirm('Clear all offline map data? This cannot be undone.')) return;
    
    try {
      await db.clearAll();
      setCachedRegions([]);
      setStorageSize(0);
    } catch (err) {
      setError(`Failed to clear cache: ${err.message}`);
    }
  }, [db]);

  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if region is cached
  const isRegionCached = (regionId) => {
    return cachedRegions.some(r => r.id === regionId);
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="offline-map-manager">
      {/* Status Bar */}
      <div className="tg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-tg-safe" />
            ) : (
              <WifiOff className="w-5 h-5 text-tg-danger" />
            )}
            <div>
              <p className="font-medium">{isOnline ? 'Online' : 'Offline'}</p>
              <p className="text-xs text-zinc-500">
                {isOnline ? 'Download maps for offline use' : 'Using cached maps'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <HardDrive className="w-4 h-4" />
            <span>{formatBytes(storageSize)}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-tg-danger/10 border border-tg-danger/30 rounded-xl text-sm text-tg-danger flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Download Progress */}
      {downloading && (
        <div className="tg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Downloading {NIGERIAN_REGIONS.find(r => r.id === downloading)?.name}...
            </span>
            <Button variant="ghost" size="sm" onClick={cancelDownload}>
              Cancel
            </Button>
          </div>
          <Progress value={downloadProgress} className="h-2" />
          <p className="text-xs text-zinc-500 mt-1">{downloadProgress}% complete</p>
        </div>
      )}

      {/* Available Regions */}
      <div className="tg-card p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Map className="w-5 h-5 text-zinc-400" />
          Available Regions
        </h3>
        
        <div className="space-y-2">
          {NIGERIAN_REGIONS.map((region) => {
            const cached = cachedRegions.find(r => r.id === region.id);
            const isCached = !!cached;
            const isDownloading = downloading === region.id;
            
            return (
              <div 
                key={region.id}
                className={`p-3 rounded-xl border transition-colors ${
                  isCached 
                    ? 'bg-tg-safe/10 border-tg-safe/30' 
                    : 'bg-zinc-800/50 border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className={`w-5 h-5 ${isCached ? 'text-tg-safe' : 'text-zinc-500'}`} />
                    <div>
                      <p className="font-medium">{region.name}</p>
                      {cached && (
                        <p className="text-xs text-zinc-500">
                          {cached.tilesCount} tiles • Downloaded {new Date(cached.downloadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isCached ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-tg-safe" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRegion(region.id)}
                          className="text-zinc-500 hover:text-tg-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => downloadRegion(region)}
                        disabled={isDownloading || !isOnline}
                        className="bg-tg-safe hover:bg-tg-safe/90 text-black"
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cached Regions Summary */}
      {cachedRegions.length > 0 && (
        <div className="tg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{cachedRegions.length} region(s) cached</p>
              <p className="text-xs text-zinc-500">
                Total: {formatBytes(storageSize)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllCache}
              className="text-tg-danger border-tg-danger/30 hover:bg-tg-danger/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Usage Tips */}
      <div className="text-xs text-zinc-600 space-y-1 px-1">
        <p>• Downloaded maps work offline for emergency situations</p>
        <p>• Each region includes multiple zoom levels (~5km radius)</p>
        <p>• Maps use dark theme tiles from CartoDB</p>
      </div>
    </div>
  );
};

export default OfflineMapManager;
