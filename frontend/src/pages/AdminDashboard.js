import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Activity, Users, AlertTriangle, CheckCircle2, Clock, Shield, RefreshCw, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { format } from 'date-fns';

const AdminDashboard = () => {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, incidentsRes, logsRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/incidents'),
        api.get('/admin/audit-logs')
      ]);
      setStats(statsRes.data);
      setIncidents(incidentsRes.data || []);
      setAuditLogs(logsRes.data || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [fetchData, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
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

  const getActionBadge = (action) => {
    if (action.includes('sos')) return 'badge-danger';
    if (action.includes('evidence')) return 'badge-warning';
    if (action.includes('profile') || action.includes('location')) return 'badge-safe';
    return 'badge-neutral';
  };

  // Access denied for non-admins
  if (!loading && user?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="tg-card p-12 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
          <p className="text-zinc-500">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="admin-dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Activity className="w-7 h-7 text-tg-safe" />
            Admin Dashboard
          </h1>
          <p className="text-zinc-500 mt-1">System overview and monitoring</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="tg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-6 h-6 text-tg-danger" />
            <span className="text-2xl font-bold text-tg-danger">{stats?.active_incidents || 0}</span>
          </div>
          <p className="text-sm text-zinc-500">Active Incidents</p>
        </div>
        <div className="tg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-6 h-6 text-tg-warning" />
            <span className="text-2xl font-bold text-tg-warning">{stats?.escalated_incidents || 0}</span>
          </div>
          <p className="text-sm text-zinc-500">Escalated</p>
        </div>
        <div className="tg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-6 h-6 text-tg-safe" />
            <span className="text-2xl font-bold text-tg-safe">{stats?.resolved_incidents || 0}</span>
          </div>
          <p className="text-sm text-zinc-500">Resolved</p>
        </div>
        <div className="tg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-6 h-6 text-blue-400" />
            <span className="text-2xl font-bold text-blue-400">{stats?.total_users || 0}</span>
          </div>
          <p className="text-sm text-zinc-500">Total Users</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="incidents">
        <TabsList className="bg-zinc-900">
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="mt-4">
          {incidents.length === 0 ? (
            <div className="tg-card p-8 text-center">
              <Shield className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-500">No incidents recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 20).map((incident) => (
                <Link
                  key={incident.id}
                  to={`/incidents/${incident.id}`}
                  className="tg-card p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors block"
                >
                  <div className={`p-2 rounded-lg ${
                    incident.status === 'active' ? 'bg-tg-danger/10' :
                    incident.status === 'escalated' ? 'bg-tg-warning/10' : 'bg-zinc-800'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 ${
                      incident.status === 'active' ? 'text-tg-danger' :
                      incident.status === 'escalated' ? 'text-tg-warning' : 'text-zinc-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{incident.owner_name || incident.owner_email}</span>
                      <span className={`badge ${getStatusBadge(incident.status)}`}>
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {incident.incident_type.replace('_', ' ')} • {format(new Date(incident.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="text-right text-sm text-zinc-500">
                    <p>Alerts: {incident.alerts_sent_count || 0}</p>
                    <p>Pings: {incident.location_pings_count || 0}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditLogs.length === 0 ? (
            <div className="tg-card p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-500">No audit logs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="tg-card p-4 flex items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{log.actor_email}</span>
                      <span className={`badge text-xs ${getActionBadge(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.target_type && (
                        <span className="badge badge-neutral text-xs">{log.target_type}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {format(new Date(log.timestamp), 'MMM d, yyyy h:mm:ss a')}
                    </p>
                  </div>
                  {log.target_id && (
                    <span className="text-xs text-zinc-600 font-mono">
                      {log.target_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
