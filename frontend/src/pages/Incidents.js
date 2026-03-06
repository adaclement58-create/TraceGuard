import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, MapPin, CheckCircle2, XCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const Incidents = () => {
  const { api } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchIncidents = useCallback(async () => {
    try {
      const response = await api.get('/incidents');
      setIncidents(response.data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIncidents();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="w-5 h-5 text-tg-danger" />;
      case 'escalated':
        return <AlertTriangle className="w-5 h-5 text-tg-warning" />;
      case 'resolved':
        return <CheckCircle2 className="w-5 h-5 text-tg-safe" />;
      default:
        return <XCircle className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-danger',
      escalated: 'badge-warning',
      resolved: 'badge-safe',
      false_alarm: 'badge-neutral'
    };
    return styles[status] || 'badge-neutral';
  };

  const filteredIncidents = incidents.filter(incident => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['active', 'escalated'].includes(incident.status);
    return incident.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="incidents-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-tg-danger" />
            Incidents
          </h1>
          <p className="text-zinc-500 mt-1">View your emergency incident history</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          data-testid="refresh-incidents"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
        {['all', 'active', 'resolved'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === tab
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white'
            }`}
            data-testid={`filter-${tab}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <div className="tg-card p-12 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">No incidents</h3>
          <p className="text-zinc-500">
            {filter === 'all' 
              ? "You haven't had any emergency incidents yet."
              : `No ${filter} incidents found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((incident) => (
            <Link
              key={incident.id}
              to={`/incidents/${incident.id}`}
              className="tg-card p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors block"
              data-testid={`incident-${incident.id}`}
            >
              <div className="p-3 rounded-xl bg-zinc-800">
                {getStatusIcon(incident.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold capitalize">
                    {incident.incident_type.replace('_', ' ')}
                  </h3>
                  <span className={`badge ${getStatusBadge(incident.status)}`}>
                    {incident.status}
                  </span>
                  {incident.kidnap_mode && (
                    <span className="badge badge-neutral">Stealth</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(incident.created_at), 'MMM d, h:mm a')}
                  </span>
                  {incident.last_known_lat && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Location recorded
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-zinc-600">
                  <span>Alerts: {incident.alerts_sent_count || 0}</span>
                  <span>Pings: {incident.location_pings_count || 0}</span>
                  <span>Evidence: {incident.evidence_count || 0}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </Link>
          ))}
        </div>
      )}

      {/* Active Incident Alert */}
      {incidents.some(i => i.status === 'active') && (
        <div className="tg-card p-4 bg-tg-danger/10 border-tg-danger/30">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-tg-danger flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="font-medium text-tg-danger">Active Emergency</p>
              <p className="text-sm text-zinc-400 mt-1">
                You have an active incident. Go to the home page to resolve it when safe.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incidents;
