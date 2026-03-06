import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Users, MapPin, AlertTriangle, FileVideo, 
  Home, Settings, Map, Building2, CreditCard, Menu, X,
  ChevronRight, LogOut, ShieldAlert, Activity, Navigation, Compass
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/trusted', icon: Users, label: 'Trusted Circle' },
  { path: '/trips', icon: MapPin, label: 'Trip Monitor' },
  { path: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { path: '/evidence', icon: FileVideo, label: 'Evidence Vault' },
  { path: '/safe-zones', icon: Map, label: 'Safe Zones' },
  { path: '/find-safety', icon: Compass, label: 'Find Safety' },
  { path: '/family', icon: Users, label: 'Family Safety' },
  { path: '/subscription', icon: CreditCard, label: 'Subscription' },
  { path: '/corporate', icon: Building2, label: 'Corporate' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const mobileNavItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/trusted', icon: Users, label: 'Trusted' },
  { path: '/trips', icon: MapPin, label: 'Trip' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 sidebar flex-col">
        <div className="flex flex-col h-full p-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tg-safe to-emerald-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white tg-heading">TRACEGUARD</h1>
              <p className="text-xs text-zinc-500">Personal Safety</p>
            </div>
          </Link>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <div className="mb-6">
              <p className="tg-label mb-2 px-3">Admin</p>
              <Link
                to="/admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive('/admin')
                    ? 'bg-tg-safe/10 text-tg-safe'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Activity className="w-5 h-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            <p className="tg-label mb-2 px-3">Navigation</p>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive(item.path)
                    ? 'bg-tg-safe/10 text-tg-safe'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {isActive(item.path) && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            ))}
          </nav>

          {/* User Footer */}
          <div className="pt-6 border-t border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <span className="text-sm font-semibold text-zinc-300">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-zinc-400 hover:text-tg-danger hover:bg-tg-danger/10 rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-800 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tg-safe to-emerald-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-white tg-heading">TRACEGUARD</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white"
            data-testid="menu-toggle"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-[#0d1f2d] animate-slide-in">
            <div className="flex flex-col h-full p-6">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-white tg-heading">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isActive(item.path)
                        ? 'bg-tg-safe/10 text-tg-safe'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      isActive('/admin')
                        ? 'bg-tg-safe/10 text-tg-safe'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                    <span className="font-medium">Admin Dashboard</span>
                  </Link>
                )}
              </nav>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-3 text-zinc-400 hover:text-tg-danger hover:bg-tg-danger/10 rounded-xl transition-all mt-4"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-72 min-h-screen pb-20 lg:pb-0 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden mobile-nav">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                isActive(item.path) ? 'text-tg-safe' : 'text-zinc-500'
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
