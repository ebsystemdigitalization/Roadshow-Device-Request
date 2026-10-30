import React, { useState } from 'react';
import { SAMLAuthProvider, signInWithPopup } from 'firebase/auth';
import { Smartphone, LogIn, AlertCircle } from 'lucide-react';
import { auth } from '../lib/firebase';

export const SsoLoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSsoLogin = async () => {
    setErrorMessage('');
    setIsLoading(true);

    try {
      const provider = new SAMLAuthProvider('saml.azure-ad');
      await signInWithPopup(auth, provider);

      // App.tsx verifies the session and loads the RDR profile.
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in was cancelled. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage(
          'Please allow popups for this website, then try again.'
        );
      } else if (
        code === 'auth/account-exists-with-different-credential'
      ) {
        setErrorMessage(
          'Your email already uses another sign-in method. Please contact the administrator to link your account.'
        );
      } else {
        setErrorMessage(
          'SSO sign-in failed. Please try again or contact the administrator.'
        );
      }

      console.error('SSO sign-in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-4">
            <Smartphone className="w-7 h-7" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Roadshow Device Request
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            CelcomDigi Employee Portal
          </p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-900">
            Employee sign in
          </h2>

          <p className="mt-2 mb-6 text-sm text-slate-500">
            Sign in using your CelcomDigi company account.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSsoLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <LogIn className="w-5 h-5" />
            {isLoading
              ? 'Signing in...'
              : 'Sign in with CelcomDigi SSO'}
          </button>

          <div className="mt-6 text-center">
            <a
              href="/admin/login"
              className="text-sm text-indigo-600 hover:underline"
            >
              Administrator sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};