import React, { useState } from 'react';
import { 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  Film, 
  Lock,
  ArrowUpRight,
  RefreshCw,
  LogOut,
  LogIn,
  KeyRound,
  AlertTriangle,
  Info
} from 'lucide-react';
import Instagram from './InstagramIcon.jsx';

export default function InstagramSessionView({ 
  statusData, 
  onOpenInstagram,
  onConnectInstagram,
  onLogoutInstagram,
  onCheckSession,
  onUpdateSession 
}) {
  const [customUrl, setCustomUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const session = statusData?.instagramSession || {};
  const isLoggedIn = Boolean(session.isLoggedIn);
  const sessionStatus = session.sessionStatus || (isLoggedIn ? 'Connected' : 'Disconnected');
  const isBridgeActive = Boolean(session.isElectronBridgeActive);
  const lastChecked = session.lastChecked ? new Date(session.lastChecked).toLocaleTimeString() : 'Not checked recently';

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      setActionNotice('');
      if (onConnectInstagram) {
        await onConnectInstagram();
        setActionNotice('Opened official Instagram login window. Log in directly with your account.');
      } else {
        onOpenInstagram('homepage');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to open Instagram login window');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      setActionNotice('');
      if (onLogoutInstagram) {
        await onLogoutInstagram();
        setActionNotice('Instagram session disconnected and local storage cleared.');
      } else if (onUpdateSession) {
        await onUpdateSession(false);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to logout from Instagram');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      setActionNotice('');
      if (onCheckSession) {
        const res = await onCheckSession();
        setActionNotice(`Session status refreshed: ${res?.status || sessionStatus}`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to refresh session status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCustom = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) {
      setErrorMsg('Please enter a valid Instagram URL');
      return;
    }
    setErrorMsg('');
    onOpenInstagram('reel', customUrl.trim());
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Overview Card */}
      <div className="p-8 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/40 to-pink-950/20 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold">
              <Instagram className="w-3.5 h-3.5" /> Official Instagram Session Hub
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Instagram Account & Session Management
            </h3>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              Connect your account securely to automatically retrieve Reel video streams for visual AI inspection. Log in exclusively through Instagram's official login interface with zero password exposure.
            </p>
          </div>

          {/* Prominent Session Status Pill */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-center shrink-0 w-full sm:w-auto min-w-[260px] shadow-lg">
            <div className="text-xs text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Connection Status</span>
              <span className="text-[10px] text-slate-500 font-mono">{lastChecked}</span>
            </div>

            <div className="py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3">
              {sessionStatus === 'Connected' ? (
                <div className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Connected</span>
                </div>
              ) : sessionStatus === 'Session Expired' ? (
                <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Session Expired</span>
                </div>
              ) : sessionStatus === 'Login Required' ? (
                <div className="text-sm font-bold text-rose-400 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Login Required</span>
                </div>
              ) : (
                <div className="text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  <span>Disconnected</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-all font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="py-1.5 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs text-red-300 border border-red-500/30 transition-all font-medium flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3 h-3" />
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Instagram Access Notice: </span>
            {errorMsg}
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Primary Connect / Authentication Section */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-pink-400" />
              Instagram Authentication Gateway
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Opens Instagram's official login interface inside an isolated application partition.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-pink-500/20 disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              Connect Instagram Account
            </button>
            <button
              onClick={() => onOpenInstagram('homepage')}
              className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              Open in Browser <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Security and Privacy Assurance Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-purple-400" /> No Password Entry
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ReelAI never asks for or stores passwords. You sign in directly on Instagram's official login page.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Isolated Partition
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Cookies and session data reside exclusively in an isolated Electron partition and are never logged or exported.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <LogOut className="w-3.5 h-3.5 text-pink-400" /> Instant Logout
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Disconnect at any time with one click to completely wipe all cached session storage and cookies.
            </p>
          </div>
        </div>
      </div>

      {/* Starting Point URLs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Exact Homepage URL */}
        <div className="p-6 rounded-3xl glass-panel glass-panel-hover border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Globe className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">
                Exact URL: ?hl=en
              </span>
            </div>
            <h4 className="text-lg font-bold text-white">Instagram Homepage</h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              https://www.instagram.com/?hl=en
            </p>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Open the official Instagram homepage in your default web browser to view your feed or verify account security.
            </p>
          </div>

          <button
            onClick={() => onOpenInstagram('homepage')}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/20"
          >
            Open Homepage in Default Browser <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Exact Reels Page URL */}
        <div className="p-6 rounded-3xl glass-panel glass-panel-hover border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <Film className="w-6 h-6" />
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">
                Exact URL: /reels
              </span>
            </div>
            <h4 className="text-lg font-bold text-white">Instagram Reels Hub</h4>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              https://www.instagram.com/reels
            </p>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Explore trending Reels directly in your browser. Copy individual Reel URLs into ReelAI for instant automated retrieval.
            </p>
          </div>

          <button
            onClick={() => onOpenInstagram('reels')}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-pink-500/20"
          >
            Open Reels Feed in Default Browser <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test / Launch Custom Reel URL */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div>
          <h4 className="text-base font-bold text-white">Open Specific Instagram Reel</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Quickly preview any public Reel link in your browser to verify availability.
          </p>
        </div>

        <form onSubmit={handleOpenCustom} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/C3b4xyZ..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            Launch Reel in Browser <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
