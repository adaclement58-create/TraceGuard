import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Building2, Users, MapPin, AlertTriangle, Plus, Loader2, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const CorporateDashboard = () => {
  const { api, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [organization, setOrganization] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [newOrg, setNewOrg] = useState({
    name: '',
    industry: '',
    address: '',
    employee_count: 10
  });

  const [newEmployee, setNewEmployee] = useState({
    email: '',
    role: 'employee'
  });

  const fetchData = useCallback(async () => {
    try {
      const orgRes = await api.get('/organization').catch(() => ({ data: null }));
      setOrganization(orgRes.data);

      if (orgRes.data) {
        const employeesRes = await api.get('/organization/employees').catch(() => ({ data: [] }));
        setEmployees(employeesRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle payment callback
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (reference && !verifying) {
      setVerifying(true);
      // Would verify corporate payment here
      api.get(`/subscription/verify/${reference}`)
        .then(() => {
          fetchData();
          window.history.replaceState({}, '', '/corporate');
        })
        .catch(console.error)
        .finally(() => setVerifying(false));
    }
  }, [searchParams, api, fetchData, verifying]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post('/organization', newOrg);
      
      // Initialize payment
      const callbackUrl = `${window.location.origin}/corporate`;
      const paymentRes = await api.post(`/organization/initialize-payment?employee_count=${newOrg.employee_count}&callback_url=${encodeURIComponent(callbackUrl)}`);
      
      if (paymentRes.data.authorization_url) {
        window.location.href = paymentRes.data.authorization_url;
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create organization');
      setSaving(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.post(`/organization/employees?email=${encodeURIComponent(newEmployee.email)}&role=${newEmployee.role}`);
      setNewEmployee({ email: '', role: 'employee' });
      setAddEmployeeOpen(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add employee');
    } finally {
      setSaving(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          {verifying && <p className="text-zinc-400">Setting up organization...</p>}
        </div>
      </div>
    );
  }

  // No organization - show setup
  if (!organization) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="corporate-setup-page">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-tg-warning" />
            Corporate Safety
          </h1>
          <p className="text-zinc-500 mt-1">Protect your employees with enterprise safety monitoring</p>
        </div>

        <div className="tg-card p-8 text-center">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-semibold mb-2">Set Up Your Organization</h3>
          <p className="text-zinc-500 mb-6 max-w-md mx-auto">
            Get started with corporate safety monitoring at ₦1,500 per employee per month.
            Track employee safety, view incidents, and manage your team.
          </p>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-tg-warning hover:bg-tg-warning/90 text-black" data-testid="setup-org-btn">
                <Plus className="w-5 h-5 mr-2" />
                Set Up Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle>Create Organization</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Organization Name *</label>
                  <Input
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                    placeholder="Company name"
                    className="bg-zinc-800 border-zinc-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Industry</label>
                  <Input
                    value={newOrg.industry}
                    onChange={(e) => setNewOrg({ ...newOrg, industry: e.target.value })}
                    placeholder="e.g., Technology, Healthcare"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Address</label>
                  <Input
                    value={newOrg.address}
                    onChange={(e) => setNewOrg({ ...newOrg, address: e.target.value })}
                    placeholder="Office address"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Number of Employees</label>
                  <Input
                    type="number"
                    value={newOrg.employee_count}
                    onChange={(e) => setNewOrg({ ...newOrg, employee_count: parseInt(e.target.value) })}
                    min={1}
                    max={1000}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Total: ₦{(newOrg.employee_count * 1500).toLocaleString()}/month
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-tg-warning hover:bg-tg-warning/90 text-black" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue to Payment'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="tg-card p-5">
            <Users className="w-8 h-8 text-tg-safe mb-3" />
            <h3 className="font-semibold mb-2">Employee Tracking</h3>
            <p className="text-sm text-zinc-500">Monitor all employee safety statuses in real-time</p>
          </div>
          <div className="tg-card p-5">
            <MapPin className="w-8 h-8 text-tg-warning mb-3" />
            <h3 className="font-semibold mb-2">Live Map View</h3>
            <p className="text-sm text-zinc-500">See all employee locations on an interactive map</p>
          </div>
          <div className="tg-card p-5">
            <AlertTriangle className="w-8 h-8 text-tg-danger mb-3" />
            <h3 className="font-semibold mb-2">Incident Alerts</h3>
            <p className="text-sm text-zinc-500">Get notified when any employee triggers SOS</p>
          </div>
        </div>
      </div>
    );
  }

  // Has organization - show dashboard
  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="corporate-dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-tg-warning" />
            {organization.name}
          </h1>
          <p className="text-zinc-500 mt-1">Corporate safety dashboard</p>
        </div>

        <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
          <DialogTrigger asChild>
            <Button className="bg-tg-safe hover:bg-tg-safe/90 text-black" data-testid="add-employee-btn">
              <Plus className="w-5 h-5 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Employee Email</label>
                <Input
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  placeholder="employee@company.com"
                  className="bg-zinc-800 border-zinc-700"
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAddEmployeeOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-tg-safe hover:bg-tg-safe/90 text-black" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Employee'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="tg-card p-5 text-center">
          <p className="text-3xl font-bold text-tg-safe">{employees.length}</p>
          <p className="text-sm text-zinc-500">Employees</p>
        </div>
        <div className="tg-card p-5 text-center">
          <p className="text-3xl font-bold text-tg-warning">{organization.max_employees}</p>
          <p className="text-sm text-zinc-500">Max Capacity</p>
        </div>
        <div className="tg-card p-5 text-center">
          <p className="text-3xl font-bold text-tg-safe">{employees.filter(e => e.status === 'active').length}</p>
          <p className="text-sm text-zinc-500">Active</p>
        </div>
        <div className="tg-card p-5 text-center">
          <p className="text-3xl font-bold text-zinc-400">₦{((organization.employee_count || 10) * 1500).toLocaleString()}</p>
          <p className="text-sm text-zinc-500">Monthly Cost</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees">
        <TabsList className="bg-zinc-900">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          {employees.length === 0 ? (
            <div className="tg-card p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-500">No employees added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((employee) => (
                <div key={employee.id} className="tg-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <span className="text-sm font-semibold">{employee.email.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-medium">{employee.email}</p>
                      <p className="text-sm text-zinc-500 capitalize">{employee.role}</p>
                    </div>
                  </div>
                  <span className={`badge ${employee.status === 'active' ? 'badge-safe' : 'badge-neutral'}`}>
                    {employee.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <div className="tg-card p-6">
            <div className="h-96 bg-zinc-800 rounded-xl flex items-center justify-center">
              <div className="text-center text-zinc-500">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Employee locations map</p>
                <p className="text-sm">Center: Nigeria (9.0765°N, 7.3986°E)</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="tg-card p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-500">No active alerts</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CorporateDashboard;
