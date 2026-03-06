import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Plus, Clock, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';

const TripMonitor = () => {
  const { api } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTrip, setNewTrip] = useState({
    destination: '',
    eta: '',
    notes: '',
    check_in_interval_minutes: 30,
    max_missed_before_escalation: 3
  });

  const fetchTrips = useCallback(async () => {
    try {
      const response = await api.get('/trips');
      setTrips(response.data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.post('/trips', newTrip);
      setTrips([response.data, ...trips]);
      setNewTrip({
        destination: '',
        eta: '',
        notes: '',
        check_in_interval_minutes: 30,
        max_missed_before_escalation: 3
      });
      setDialogOpen(false);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (tripId) => {
    try {
      await api.post(`/trips/${tripId}/check-in`);
      fetchTrips();
    } catch (error) {
      alert('Check-in failed');
    }
  };

  const handleComplete = async (tripId) => {
    try {
      await api.post(`/trips/${tripId}/complete`);
      fetchTrips();
    } catch (error) {
      alert('Failed to complete trip');
    }
  };

  const handleCancel = async (tripId) => {
    if (!window.confirm('Cancel this trip?')) return;
    try {
      await api.post(`/trips/${tripId}/cancel`);
      fetchTrips();
    } catch (error) {
      alert('Failed to cancel trip');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-safe',
      overdue: 'badge-warning',
      escalated: 'badge-danger',
      completed: 'badge-safe',
      cancelled: 'badge-neutral'
    };
    return styles[status] || 'badge-neutral';
  };

  const activeTrips = trips.filter(t => ['active', 'overdue', 'escalated'].includes(t.status));
  const pastTrips = trips.filter(t => ['completed', 'cancelled'].includes(t.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="trip-monitor-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <MapPin className="w-7 h-7 text-tg-warning" />
            Trip Monitor
          </h1>
          <p className="text-zinc-500 mt-1">Track your journeys and stay safe</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-tg-warning hover:bg-tg-warning/90 text-black"
              data-testid="create-trip-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Start New Trip</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTrip} className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Destination *</label>
                <Input
                  value={newTrip.destination}
                  onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
                  placeholder="Where are you going?"
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="trip-destination-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Expected Arrival Time *</label>
                <Input
                  type="datetime-local"
                  value={newTrip.eta}
                  onChange={(e) => setNewTrip({ ...newTrip, eta: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="trip-eta-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Check-in Interval (minutes)</label>
                <Input
                  type="number"
                  value={newTrip.check_in_interval_minutes}
                  onChange={(e) => setNewTrip({ ...newTrip, check_in_interval_minutes: parseInt(e.target.value) })}
                  min={5}
                  max={120}
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="trip-interval-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Notes</label>
                <Input
                  value={newTrip.notes}
                  onChange={(e) => setNewTrip({ ...newTrip, notes: e.target.value })}
                  placeholder="Any additional details"
                  className="bg-zinc-800 border-zinc-700"
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
                  className="flex-1 bg-tg-warning hover:bg-tg-warning/90 text-black"
                  disabled={saving}
                  data-testid="start-trip-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Trip'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Trips */}
      {activeTrips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-300">Active Trips</h2>
          {activeTrips.map((trip) => (
            <div
              key={trip.id}
              className="tg-card p-5"
              data-testid={`trip-${trip.id}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{trip.destination}</h3>
                    <span className={`badge ${getStatusBadge(trip.status)}`}>
                      {trip.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ETA: {format(new Date(trip.eta), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
                {trip.status === 'escalated' && (
                  <AlertTriangle className="w-6 h-6 text-tg-danger animate-pulse" />
                )}
              </div>

              {trip.notes && (
                <p className="text-sm text-zinc-400 mb-4">{trip.notes}</p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleCheckIn(trip.id)}
                  className="bg-tg-safe hover:bg-tg-safe/90 text-black"
                  data-testid={`checkin-${trip.id}`}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Check In
                </Button>
                <Button
                  onClick={() => handleComplete(trip.id)}
                  variant="outline"
                  className="border-tg-safe text-tg-safe hover:bg-tg-safe/10"
                  data-testid={`complete-${trip.id}`}
                >
                  Arrived Safely
                </Button>
                <Button
                  onClick={() => handleCancel(trip.id)}
                  variant="ghost"
                  className="text-zinc-500 hover:text-tg-danger"
                  data-testid={`cancel-${trip.id}`}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-6 text-sm text-zinc-500">
                <span>Last check-in: {format(new Date(trip.last_check_in), 'h:mm a')}</span>
                <span>Interval: {trip.check_in_interval_minutes} min</span>
                <span>Missed: {trip.missed_check_ins}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Active Trips */}
      {activeTrips.length === 0 && (
        <div className="tg-card p-12 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">No active trips</h3>
          <p className="text-zinc-500 mb-4">Start a trip to let your contacts know you're traveling</p>
          <Button
            className="bg-tg-warning hover:bg-tg-warning/90 text-black"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Start New Trip
          </Button>
        </div>
      )}

      {/* Past Trips */}
      {pastTrips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-300">Past Trips</h2>
          {pastTrips.slice(0, 5).map((trip) => (
            <div
              key={trip.id}
              className="tg-card p-4 opacity-60"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{trip.destination}</h3>
                    <span className={`badge ${getStatusBadge(trip.status)}`}>
                      {trip.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {format(new Date(trip.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="tg-card p-4 bg-tg-warning/5 border-tg-warning/20">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-tg-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-tg-warning">How Trip Monitor Works</p>
            <p className="text-sm text-zinc-400 mt-1">
              If you miss too many check-ins or don't arrive by your ETA, your trusted contacts will be automatically notified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripMonitor;
