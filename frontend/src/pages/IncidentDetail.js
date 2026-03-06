import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, Clock, MapPin, ChevronLeft, FileVideo, Radio, Image, Activity } from 'lucide-react';
import { format } from 'date-fns';

const IncidentDetail = () => {
  const { api, user } = useAuth();
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchIncident = useCallback(async () => {
    try {
      const response = await api.get(`/incidents/${id}`);
      setIncident(response.data);
    } catch (error) {
      console.error('Error fetching incident:', error);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-danger',
      escalated: 'badge-warning',
      resolved: 'badge-safe',
      false_alarm: 'badge-neutral'
    };
    return styles[status] || 'badge-neutral';
  };

  const getEvidenceIcon = (type) => {
    switch (type) {
      case 'audio': return <Radio className="w-5 h-5" />;
      case 'video': return <FileVideo className="w-5 h-5" />;
      case 'photo': return <Image className="w-5 h-5" />;
      default: return <FileVideo className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="tg-card p-12 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">Incident not found</h3>
          <Link to="/incidents" className="text-tg-safe hover:underline">
            Back to incidents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="incident-detail-page">
      {/* Back Link */}
      <Link
        to="/incidents"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Incidents
      </Link>

      {/* Header */}
      <div className="tg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tg-heading tracking-tight capitalize">
                {incident.incident_type.replace('_', ' ')}
              </h1>
              <span className={`badge ${getStatusBadge(incident.status)}`}>
                {incident.status}
              </span>
            </div>
            <p className="text-zinc-500">
              ID: {incident.id.slice(0, 8)} • Created by {incident.owner_name || incident.owner_email}
            </p>
          </div>
          {incident.status === 'active' && (
            <div className="p-3 rounded-xl bg-tg-danger/10">
              <Activity className="w-6 h-6 text-tg-danger animate-pulse" />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
            <p className="text-2xl font-bold text-tg-safe">{incident.alerts_sent_count || 0}</p>
            <p className="text-sm text-zinc-500">Alerts Sent</p>
          </div>
          <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
            <p className="text-2xl font-bold text-tg-warning">{incident.location_pings_count || 0}</p>
            <p className="text-sm text-zinc-500">Location Pings</p>
          </div>
          <div className="text-center p-4 bg-zinc-800/50 rounded-xl">
            <p className="text-2xl font-bold text-blue-400">{incident.evidence_count || 0}</p>
            <p className="text-sm text-zinc-500">Evidence Items</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 pt-6 border-t border-zinc-800">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4" />
              <span>Started: {format(new Date(incident.created_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {incident.resolved_at && (
              <div className="flex items-center gap-2 text-tg-safe">
                <Clock className="w-4 h-4" />
                <span>Resolved: {format(new Date(incident.resolved_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location */}
      {incident.last_known_lat && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-tg-warning" />
            Last Known Location
          </h2>
          <div className="h-64 bg-zinc-800 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-sm text-zinc-400">
                {incident.last_known_lat.toFixed(6)}, {incident.last_known_lng.toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${incident.last_known_lat},${incident.last_known_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tg-safe text-sm hover:underline mt-2 inline-block"
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Location Pings */}
      {incident.location_pings && incident.location_pings.length > 0 && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Location History
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {incident.location_pings.map((ping, index) => (
              <div
                key={ping.id || index}
                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-tg-safe" />
                  <span className="text-zinc-400">
                    {ping.latitude.toFixed(6)}, {ping.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  {ping.battery && <span>{ping.battery}%</span>}
                  <span>{format(new Date(ping.timestamp), 'h:mm:ss a')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      {incident.evidence && incident.evidence.length > 0 && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileVideo className="w-5 h-5 text-purple-400" />
            Evidence
          </h2>
          <div className="space-y-3">
            {incident.evidence.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-700 rounded-lg">
                    {getEvidenceIcon(item.evidence_type)}
                  </div>
                  <div>
                    <p className="font-medium capitalize">{item.evidence_type}</p>
                    <p className="text-xs text-zinc-500">
                      {format(new Date(item.captured_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 font-mono">
                    {item.sha256_hash?.slice(0, 16)}...
                  </p>
                  {item.duration && (
                    <p className="text-xs text-zinc-500">{item.duration}s</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolution */}
      {incident.resolution_reason && (
        <div className="tg-card p-6 bg-tg-safe/5 border-tg-safe/20">
          <h2 className="text-lg font-semibold mb-2 text-tg-safe">Resolution</h2>
          <p className="text-zinc-400 capitalize">
            {incident.resolution_reason.replace('_', ' ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default IncidentDetail;
