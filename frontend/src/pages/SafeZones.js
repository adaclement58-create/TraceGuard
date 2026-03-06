import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Map, Plus, Trash2, Home, Building2, GraduationCap, MapPin, Loader2, Power, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { SafeZonesMap } from '../components/LocationMap';

const SafeZones = () => {
  const { api } = useAuth();
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [newZone, setNewZone] = useState({
    name: '',
    zone_type: 'home',
    latitude: null,
    longitude: null,
    radius: 200,
    notify_on_enter: true,
    notify_on_exit: true
  });

  const fetchZones = useCallback(async () => {
    try {
      const response = await api.get('/safe-zones');
      setZones(response.data || []);
      
      // Get user's current location for the map
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => {},
          { timeout: 5000 }
        );
      }
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewZone({
          ...newZone,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGettingLocation(false);
      },
      (error) => {
        alert('Could not get location. Please enable location services.');
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    if (!newZone.latitude || !newZone.longitude) {
      alert('Please set your current location first');
      return;
    }
    setSaving(true);

    try {
      const response = await api.post('/safe-zones', newZone);
      setZones([...zones, response.data]);
      setNewZone({
        name: '',
        zone_type: 'home',
        latitude: null,
        longitude: null,
        radius: 200,
        notify_on_enter: true,
        notify_on_exit: true
      });
      setDialogOpen(false);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create zone');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleZone = async (zoneId, isActive) => {
    try {
      await api.put(`/safe-zones/${zoneId}?is_active=${!isActive}`);
      setZones(zones.map(z => z.id === zoneId ? { ...z, is_active: !isActive } : z));
    } catch (error) {
      alert('Failed to update zone');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!window.confirm('Delete this safe zone?')) return;
    setDeleting(zoneId);

    try {
      await api.delete(`/safe-zones/${zoneId}`);
      setZones(zones.filter(z => z.id !== zoneId));
    } catch (error) {
      alert('Failed to delete zone');
    } finally {
      setDeleting(null);
    }
  };

  const getZoneIcon = (type) => {
    switch (type) {
      case 'home': return <Home className="w-5 h-5 text-tg-safe" />;
      case 'work': return <Building2 className="w-5 h-5 text-tg-warning" />;
      case 'school': return <GraduationCap className="w-5 h-5 text-blue-400" />;
      default: return <MapPin className="w-5 h-5 text-purple-400" />;
    }
  };

  const getZoneColor = (type) => {
    switch (type) {
      case 'home': return 'border-tg-safe/30 bg-tg-safe/5';
      case 'work': return 'border-tg-warning/30 bg-tg-warning/5';
      case 'school': return 'border-blue-400/30 bg-blue-400/5';
      default: return 'border-purple-400/30 bg-purple-400/5';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="safe-zones-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Map className="w-7 h-7 text-blue-400" />
            Safe Zones
          </h1>
          <p className="text-zinc-500 mt-1">Set up geofenced areas for automatic alerts</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="add-zone-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Create Safe Zone</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateZone} className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Zone Name *</label>
                <Input
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="e.g., Home, Office"
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="zone-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Zone Type</label>
                <Select
                  value={newZone.zone_type}
                  onValueChange={(value) => setNewZone({ ...newZone, zone_type: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Location *</label>
                <Button
                  type="button"
                  variant={newZone.latitude ? "default" : "outline"}
                  className={`w-full ${newZone.latitude ? 'bg-tg-safe hover:bg-tg-safe/90 text-black' : ''}`}
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  data-testid="get-location-btn"
                >
                  {gettingLocation ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : newZone.latitude ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <MapPin className="w-4 h-4 mr-2" />
                  )}
                  {newZone.latitude ? 'Location Set ✓' : 'Use Current Location'}
                </Button>
                {newZone.latitude && (
                  <p className="text-xs text-tg-safe mt-2">
                    📍 {newZone.latitude.toFixed(6)}, {newZone.longitude.toFixed(6)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Radius (meters)</label>
                <Input
                  type="number"
                  value={newZone.radius}
                  onChange={(e) => setNewZone({ ...newZone, radius: parseInt(e.target.value) })}
                  min={50}
                  max={5000}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="zone-radius-input"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm">Notify on enter</span>
                <Switch
                  checked={newZone.notify_on_enter}
                  onCheckedChange={(checked) => setNewZone({ ...newZone, notify_on_enter: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm">Notify on exit</span>
                <Switch
                  checked={newZone.notify_on_exit}
                  onCheckedChange={(checked) => setNewZone({ ...newZone, notify_on_exit: checked })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={saving}
                  data-testid="save-zone-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Zone'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Zones List */}
      {zones.length === 0 ? (
        <div className="tg-card p-12 text-center">
          <Map className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">No safe zones</h3>
          <p className="text-zinc-500 mb-4">Create zones to get notified when entering or leaving areas</p>
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Your First Zone
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`tg-card p-5 ${getZoneColor(zone.zone_type)} ${!zone.is_active ? 'opacity-50' : ''}`}
              data-testid={`zone-${zone.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg">
                    {getZoneIcon(zone.zone_type)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{zone.name}</h3>
                    <p className="text-xs text-zinc-500 capitalize">{zone.zone_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleZone(zone.id, zone.is_active)}
                    className={`p-2 rounded-lg transition-colors ${
                      zone.is_active
                        ? 'text-tg-safe bg-tg-safe/10'
                        : 'text-zinc-500 bg-zinc-800'
                    }`}
                    title={zone.is_active ? 'Active' : 'Inactive'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteZone(zone.id)}
                    disabled={deleting === zone.id}
                    className="p-2 text-zinc-500 hover:text-tg-danger hover:bg-tg-danger/10 rounded-lg transition-colors"
                  >
                    {deleting === zone.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-center justify-between">
                  <span>Radius</span>
                  <span>{zone.radius}m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Notify on enter</span>
                  <span className={zone.notify_on_enter ? 'text-tg-safe' : 'text-zinc-600'}>
                    {zone.notify_on_enter ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Notify on exit</span>
                  <span className={zone.notify_on_exit ? 'text-tg-safe' : 'text-zinc-600'}>
                    {zone.notify_on_exit ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {zone.last_event && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <span className={`badge ${zone.last_event === 'enter' ? 'badge-safe' : 'badge-warning'}`}>
                    {zone.last_event === 'enter' ? 'Inside' : 'Outside'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zones Map */}
      {zones.length > 0 && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-400" />
            Zone Map
          </h2>
          <SafeZonesMap zones={zones} userLocation={userLocation} />
        </div>
      )}

      {/* Info */}
      <div className="tg-card p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex gap-3">
          <Map className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-400">How Safe Zones Work</p>
            <p className="text-sm text-zinc-400 mt-1">
              When you enter or leave a safe zone, your trusted contacts will receive automatic notifications.
              This helps them know you've arrived safely or left an area.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafeZones;
