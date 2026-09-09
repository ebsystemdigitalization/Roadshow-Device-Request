import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

import { auth } from '../lib/firebase';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter your Email Address (Login ID).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your Password.');
      return;
    }

    setIsLoading(true);

    try {
      // Tier 1 authenticates the credentials using Firebase Authentication.
      const credential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // Obtain a secure Firebase ID token for the Cloud Run backend.
      const idToken = await credential.user.getIdToken();

      // Request the RDR profile from the application tier.
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/me`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${idToken}`
          }
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        await auth.signOut();

        throw new Error(
          payload.message ||
            'Unable to retrieve your Roadshow Device Request profile.'
        );
      }

      // Supports either { user: {...} } or a direct profile response.
      const profile = payload.user ?? payload;

      if (!profile.name || !profile.role) {
        await auth.signOut();

        throw new Error(
          'Your Roadshow Device Request profile is incomplete.'
        );
      }

      if (
        profile.userStatus === 'Inactive' ||
        profile.status === 'Inactive'
      ) {
        await auth.signOut();

        throw new Error(
          'Account Suspended: This account is inactive. Please contact your system administrator.'
        );
      }

      const authenticatedUser: User = {
        id: profile.id || credential.user.uid,
        name: profile.name,
        email:
          profile.email ||
          credential.user.email ||
          cleanEmail,
        role: profile.role,
        state: profile.state || '',
        region: profile.region || '',
        avatarUrl: profile.avatarUrl,
        headOfUnit: profile.headOfUnit,
        headOfSales: profile.headOfSales,
        headOfDepartment: profile.headOfDepartment,
        userStatus: profile.userStatus || 'Active',
        status: profile.status
      };

      onLoginSuccess(authenticatedUser);
    } catch (error) {
      console.error('Login failed:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Authentication failed. Please try again.';

      if (
        message.includes('auth/invalid-credential') ||
        message.includes('auth/user-not-found') ||
        message.includes('auth/wrong-password') ||
        message.includes('auth/invalid-login-credentials')
      ) {
        setErrorMessage('Incorrect email address or password.');
      } else if (message.includes('auth/too-many-requests')) {
        setErrorMessage(
          'Too many failed login attempts. Please try again later.'
        );
      } else if (message.includes('auth/user-disabled')) {
        setErrorMessage(
          'This authentication account has been disabled.'
        );
      } else if (message.includes('Failed to fetch')) {
        setErrorMessage(
          'Unable to connect to the RDR backend. Please check your connection.'
        );
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 mb-4 ring-4 ring-white/10">
            <Smartphone className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Roadshow Device Request
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Enterprise workflow & multi-tier approval management
            portal
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-white/20">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-indigo-600" />
              Sign in to your account
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Use your registered Firebase Authentication email
              address and password
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />

              <div className="flex-1 font-medium leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Login ID (Email Address) *
              </label>

              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>

                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your registered email"
                  disabled={isLoading}
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Password *
                </label>

                <span className="text-[11px] text-indigo-600 font-medium">
                  Secured by Firebase Authentication
                </span>
              </div>

              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>

                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer disabled:cursor-not-allowed"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Portal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />

          <span>
            Secured with Firebase Authentication and Role-Based
            Access Control
          </span>
        </div>
      </div>
    </div>
  );
};