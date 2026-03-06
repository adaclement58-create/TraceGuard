import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, MapPin, AlertTriangle, Plus, X, Lock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const FamilyDashboard = () => {
  const { api, user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [members, setMembers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const subRes = await api.get('/subscription').catch(() => ({ data: { plan: 'basic' } }));
      setSubscription(subRes.data);

      if (subRes.data?.plan === 'family') {
        const [membersRes, incidentsRes] = await Promise.all([
          api.get('/family/members').catch(() => ({ data: [] })),
          api.get('/family/incidents').catch(() => ({ data: [] }))
        ]);
        setMembers(membersRes.data || []);
        setIncidents(incidentsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching family data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post(`/family/members?email=${encodeURIComponent(newEmail)}`);
      setNewEmail('');
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (email) => {
    if (!window.confirm('Remove this family member?')) return;

    try {
      await api.delete(`/family/members/${encodeURIComponent(email)}`);
      fetchData();
    } catch (error) {
      alert('Failed to remove member');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'safe': return 'bg-tg-safe';
      case 'sos_active': return 'bg-tg-danger';
      case 'trip_active': return 'bg-tg-warning';
      default: return 'bg-zinc-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'safe': return 'Safe';
      case 'sos_active': return 'SOS Active';
      case 'trip_active': return 'On Trip';
      default: return 'Offline';
    }
  };

  const plan = subscription?.plan || 'basic';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  // Feature gate for non-family plan users
  if (plan !== 'family') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-tg-safe" />
            Family Safety
          </h1>
          <p className="text-zinc-500 mt-1">Monitor your family's safety in real-time</p>
        </div>

        <div className="tg-card p-12 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-semibold mb-2">Family Plan Required</h3>
          <p className="text-zinc-500 mb-6 max-w-md mx-auto">
            The Family Dashboard allows you to monitor up to 5 family members' safety status,
            locations, and incidents in real-time.
          </p>
          <a href="/subscription" className="btn btn-primary inline-flex">
            Upgrade to Family Plan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="family-dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-tg-safe" />
            Family Safety
          </h1>
          <p className="text-zinc-500 mt-1">Monitor your family's safety in real-time</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-tg-safe hover:bg-tg-safe/90 text-black"
              disabled={members.length >= 5}
              data-testid="add-member-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Add Family Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Member's Email
                </label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="family@email.com"
                  className="bg-zinc-800 border-zinc-700"
                  required
                />
                <p className="text-xs text-zinc-500 mt-2">
                  They must have a TRACEGUARD account with this email.
                </p>
              </div>
              <div className="flex gap-3">
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
                  className="flex-1 bg-tg-safe hover:bg-tg-safe/90 text-black"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Member'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Alerts */}
      {incidents.length > 0 && (
        <div className="tg-card p-5 bg-tg-danger/10 border-tg-danger/30">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-tg-danger animate-pulse" />
            <h2 className="font-semibold text-tg-danger">Active Emergencies</h2>
          </div>
          <div className="space-y-2">
            {incidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between p-3 bg-tg-danger/10 rounded-lg">
                <div>
                  <p className="font-medium">{incident.owner_name || incident.owner_email}</p>
                  <p className="text-sm text-zinc-400 capitalize">{incident.incident_type.replace('_', ' ')}</p>
                </div>
                <a
                  href={`/incidents/${incident.id}`}
                  className="text-tg-danger hover:underline text-sm"
                >
                  View Details
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Members */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-300">
          Family Members ({members.length}/5)
        </h2>

        {members.length === 0 ? (
          <div className="tg-card p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-500">No family members added yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((member) => (
              <div
                key={member.email}
                className="tg-card p-5"
                data-testid={`member-${member.email}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <span className="text-lg font-semibold">
                        {member.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{member.full_name || 'Unknown'}</p>
                      <p className="text-sm text-zinc-500">{member.email}</p>
                    </div>
                  </div>
                  {member.email !== user?.email && (
                    <button
                      onClick={() => handleRemoveMember(member.email)}
                      className="p-1 text-zinc-500 hover:text-tg-danger"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${getStatusColor(member.status)}`} />
                    <span className="text-sm">{getStatusText(member.status)}</span>
                  </div>

                  {member.location && (
                    <a
                      href={`https://www.google.com/maps?q=${member.location.latitude},${member.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-tg-safe hover:underline"
                    >
                      <MapPin className="w-4 h-4" />
                      View Location
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map Placeholder */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-tg-warning" />
          Family Map
        </h2>
        <div className="h-64 bg-zinc-800 rounded-xl flex items-center justify-center">
          <div className="text-center text-zinc-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Map view shows family member locations</p>
            <p className="text-sm">Center: Nigeria (9.0765°N, 7.3986°E)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyDashboard;
