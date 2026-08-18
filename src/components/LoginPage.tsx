import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Smartphone, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, KeyRound, CheckCircle2, ChevronRight, UserCheck } from 'lucide-react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);

  const PROTOTYPE_PASSWORD = 'hehe123';

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Sales Team':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Head of Sales':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Device Team':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Head of Operation':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'Head of Department':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'Admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    // 1. Find user by case-insensitive email match
    const matchedUser = users.find(
      u => u.email.trim().toLowerCase() === trimmedEmail
    );

    // 2. Validate prototype password
    if (!matchedUser || trimmedPassword !== PROTOTYPE_PASSWORD) {
      setErrorMessage('Invalid email or password.');
      return;
    }

    // 3. Check userStatus / status
    const status = matchedUser.userStatus || matchedUser.status || 'Active';
    if (status !== 'Active') {
      setErrorMessage('This account is inactive. Please contact system administrator.');
      return;
    }

    // 4. Authenticate user
    onLogin(matchedUser);
  };

  const handleSelectDemoUser = (demoUser: User) => {
    setEmail(demoUser.email);
    setPassword(PROTOTYPE_PASSWORD);
    setErrorMessage(null);
  };

  const handleQuickLogin = (demoUser: User) => {
    const status = demoUser.userStatus || demoUser.status || 'Active';
    if (status !== 'Active') {
      setEmail(demoUser.email);
      setPassword(PROTOTYPE_PASSWORD);
      setErrorMessage('This account is inactive. Please contact system administrator.');
      return;
    }
    onLogin(demoUser);
  };

  // Group unique sample users for the demo accounts helper
  const activeDemoUsers = users.filter(u => (u.userStatus || u.status || 'Active') === 'Active');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8 text-slate-100 font-sans">
      {/* Top Brand Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Roadshow Device Request
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-400/30">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-tier approval & inventory management portal
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Prototype Authentication System</span>
        </div>
      </div>

      {/* Main Login Content Card */}
      <div className="max-w-5xl w-full mx-auto my-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left / Main: Sign In Box */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to Portal</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your corporate email and password to access your role-based dashboard.
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-700 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. ahmad.razak@company.com"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder:text-slate-400 outline-none transition-all"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Demo password: <strong className="text-blue-600">{PROTOTYPE_PASSWORD}</strong>
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-slate-900 rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder:text-slate-400 outline-none transition-all"
                  autoComplete="current-password"
                />
                <button
                  id="btn-toggle-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="btn-login-submit"
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            </div>
          </form>

          {/* Prototype credentials note */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              All active users in this prototype use the standard password: <code className="text-amber-800 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">{PROTOTYPE_PASSWORD}</code>
            </span>
          </div>
        </div>

        {/* Right / Helper: Quick Demo Accounts */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Demo Accounts
              </h3>
            </div>
            <button
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {showDemoAccounts ? 'Collapse' : 'Expand'}
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Click any account below to autofill and test its role-specific permissions:
          </p>

          {showDemoAccounts && (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {activeDemoUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelectDemoUser(user)}
                  className={`group p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    email.toLowerCase() === user.email.toLowerCase()
                      ? 'bg-blue-950/50 border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                        {user.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(user.role)}`}>
                      {user.role}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickLogin(user);
                      }}
                      className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg transition-all shadow-sm"
                      title="Direct 1-Click Login"
                    >
                      Login
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500 pt-4 border-t border-slate-800/60">
        <p>Roadshow Device Request System &bull; Prototype Authentication & Access Control</p>
      </div>
    </div>
  );
};
