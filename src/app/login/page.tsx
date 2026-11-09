'use client';

import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [accessKey, setAccessKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Authenticated successfully - redirect to main application
        window.location.href = data.redirectUrl || '/';
      } else {
        // Incorrect key or rate limited: redirect to https://ugandhar.in
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        setErrorMessage(data.error || 'Authentication failed.');
      }
    } catch {
      // Network or unexpected failure - safe redirect
      window.location.href = 'https://ugandhar.in';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 transition-colors dark:bg-[#090d16]">
      <div className="w-full max-w-sm">
        {/* Minimal branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-950">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Private Assistant
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enter your access key to continue
          </p>
        </div>

        {/* Access Form */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="accessKey"
                className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Access Key
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="accessKey"
                  type={showKey ? 'text' : 'password'}
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="••••••••••••"
                  autoFocus
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-blue-400 dark:focus:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !accessKey.trim()}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <span>Unlock</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          Technical Assistant • Encrypted Session
        </p>
      </div>
    </div>
  );
}
