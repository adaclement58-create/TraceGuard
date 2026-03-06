import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (!formData.full_name.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        await register(formData.email, formData.password, formData.full_name);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tg-safe to-emerald-600 flex items-center justify-center mb-4">
            <ShieldAlert className="w-9 h-9 text-black" />
          </div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight">TRACEGUARD</h1>
          <p className="text-zinc-500 mt-1">Personal Safety System</p>
        </div>

        {/* Form Card */}
        <div className="tg-card-elevated p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-tg-danger/10 border border-tg-danger/30 text-tg-danger rounded-xl p-3 mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="pl-10 bg-zinc-800/50 border-zinc-700"
                    data-testid="register-name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-zinc-800/50 border-zinc-700"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 bg-zinc-800/50 border-zinc-700"
                  required
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-tg-safe hover:bg-tg-safe/90 text-black font-semibold h-12"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-zinc-400 hover:text-tg-safe transition-colors"
              data-testid="toggle-auth-mode"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="text-zinc-400 hover:text-tg-safe">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-zinc-400 hover:text-tg-safe">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
