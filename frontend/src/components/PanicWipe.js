import React, { useState, useCallback } from 'react';
import { 
  Trash2, ShieldAlert, AlertTriangle, Lock, Unlock,
  CheckCircle2, Loader2, Key
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Panic Data Wipe - Instantly destroy all sensitive data
// Works 100% OFFLINE - clears localStorage, sessionStorage, IndexedDB

const PanicWipe = ({ onWipeComplete, className = '' }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeComplete, setWipeComplete] = useState(false);
  const [wipeStats, setWipeStats] = useState(null);

  const WIPE_CODE = 'WIPE'; // User must type this to confirm

  // Perform the data wipe
  const performWipe = useCallback(async () => {
    setIsWiping(true);
    let itemsCleared = 0;
    let errors = [];

    try {
      // 1. Clear localStorage
      const localStorageKeys = Object.keys(localStorage);
      localStorageKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          itemsCleared++;
        } catch (e) {
          errors.push(`localStorage: ${key}`);
        }
      });

      // 2. Clear sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorageKeys.forEach(key => {
        try {
          sessionStorage.removeItem(key);
          itemsCleared++;
        } catch (e) {
          errors.push(`sessionStorage: ${key}`);
        }
      });

      // 3. Clear IndexedDB
      if (window.indexedDB) {
        const databases = await window.indexedDB.databases?.() || [];
        for (const db of databases) {
          if (db.name) {
            try {
              await new Promise((resolve, reject) => {
                const request = window.indexedDB.deleteDatabase(db.name);
                request.onsuccess = resolve;
                request.onerror = reject;
              });
              itemsCleared++;
            } catch (e) {
              errors.push(`IndexedDB: ${db.name}`);
            }
          }
        }
      }

      // 4. Clear cookies (same origin only)
      document.cookie.split(";").forEach(cookie => {
        const name = cookie.split("=")[0].trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        itemsCleared++;
      });

      // 5. Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          try {
            await caches.delete(name);
            itemsCleared++;
          } catch (e) {
            errors.push(`Cache: ${name}`);
          }
        }
      }

      // 6. Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          try {
            await registration.unregister();
            itemsCleared++;
          } catch (e) {
            errors.push('Service Worker');
          }
        }
      }

      setWipeStats({
        itemsCleared,
        errors: errors.length,
        timestamp: new Date().toISOString()
      });

      setWipeComplete(true);

      // Vibrate to confirm
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }

      // Call parent callback
      if (onWipeComplete) {
        onWipeComplete({ itemsCleared, errors });
      }

      // Force reload after short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);

    } catch (e) {
      console.error('Panic wipe error:', e);
      errors.push('General error');
    } finally {
      setIsWiping(false);
    }
  }, [onWipeComplete]);

  // Handle confirm
  const handleConfirm = () => {
    if (confirmCode.toUpperCase() === WIPE_CODE) {
      performWipe();
    } else {
      alert('Incorrect code. Type WIPE to confirm.');
    }
  };

  // Quick wipe (triple-tap trigger)
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  const handleQuickTap = () => {
    const now = Date.now();
    if (now - lastTap < 500) {
      setTapCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          setShowConfirm(true);
          return 0;
        }
        return newCount;
      });
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  };

  return (
    <>
      <div 
        className={`tg-card p-4 border-red-500/20 ${className}`} 
        data-testid="panic-wipe"
        onClick={handleQuickTap}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-medium text-red-400">Panic Data Wipe</p>
              <p className="text-xs text-zinc-500">
                Triple-tap or hold to erase all data
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(true);
            }}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <ShieldAlert className="w-4 h-4" />
          </Button>
        </div>

        {/* Tap indicator */}
        {tapCount > 0 && (
          <div className="mt-2 flex gap-1 justify-center">
            {[1, 2, 3].map(i => (
              <div 
                key={i}
                className={`w-2 h-2 rounded-full ${i <= tapCount ? 'bg-red-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-zinc-600 mt-3 text-center">
          Instantly erases: login data, messages, locations, settings
        </p>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-zinc-900 border-red-500/30">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirm Data Wipe
            </DialogTitle>
          </DialogHeader>
          
          {!wipeComplete ? (
            <div className="py-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-300 font-medium mb-2">
                  ⚠️ This will permanently delete:
                </p>
                <ul className="text-xs text-red-200/80 space-y-1 list-disc list-inside">
                  <li>All login sessions and tokens</li>
                  <li>Saved messages and chat history</li>
                  <li>Cached locations and maps</li>
                  <li>App settings and preferences</li>
                  <li>Offline data and evidence</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Type <span className="font-mono font-bold text-red-400">WIPE</span> to confirm:
                </p>
                <Input
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.toUpperCase())}
                  placeholder="Type WIPE"
                  className="bg-zinc-800 border-red-500/30 text-center font-mono text-lg"
                  disabled={isWiping}
                />
                
                <Button
                  onClick={handleConfirm}
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={isWiping || confirmCode !== WIPE_CODE}
                >
                  {isWiping ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wiping Data...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Wipe All Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-tg-safe mx-auto mb-4" />
              <p className="text-lg font-medium text-tg-safe mb-2">Data Wiped Successfully</p>
              {wipeStats && (
                <p className="text-sm text-zinc-500">
                  {wipeStats.itemsCleared} items cleared
                  {wipeStats.errors > 0 && `, ${wipeStats.errors} errors`}
                </p>
              )}
              <p className="text-xs text-zinc-600 mt-4">
                Redirecting to login...
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PanicWipe;
