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
  Sparkles
} from 'lucide-react';
import Instagram from './InstagramIcon.jsx';

export default function InstagramSessionView({ 
  statusData, 
  onOpenInstagram, 
  onUpdateSession 
}) {
  const [customUrl, setCustomUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isLoggedIn = Boolean(statusData?.instagramSession?.isLoggedIn);

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
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold">
              <Instagram className="w-3.5 h-3.5" /> Official Browser Integration
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Instagram Session & Privacy Hub
            </h3>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              Authenticate directly through your existing browser session. ReelAI operates without collecting passwords, ensuring full account safety and Instagram policy compliance.
            </p>
          </div>

          {/* Session Status Pill */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center shrink-0">
            <div className="text-xs text-slate-400 mb-1">Session Status</div>
            <div className={`text-sm font-bold flex items-center justify-center gap-2 ${
              isLoggedIn ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {isLoggedIn ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{isLoggedIn ? 'Active Browser Login' : 'Needs Verification'}</span>
            </div>
            <button
              onClick={() => onUpdateSession(!isLoggedIn)}
              className="mt-3 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-all font-medium"
            >
              {isLoggedIn ? 'Mark as Not Logged In' : 'Confirm Logged In'}
            </button>
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
            <p className="text-xs text-slate-400 mt-1">
              https://www.instagram.com/?hl=en
            </p>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Open the official Instagram homepage in your default web browser to log into your account or view your feed.
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
            <p className="text-xs text-slate-400 mt-1">
              https://www.instagram.com/reels
            </p>
            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Explore trending Reels directly in your browser. Copy individual Reel URLs into ReelAI for instant video analysis.
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

      {/* Open Any Custom Reel URL */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div>
          <h4 className="text-base font-bold text-white">Open Specific Instagram Reel</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Quickly test opening any public Reel link in your default browser.
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
        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
      </div>

      {/* Privacy & Compliance Assurance */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Security & Policy Adherence Principles</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" /> Never Stores Passwords
            </div>
            <p className="text-slate-400 leading-relaxed">
              Login is handled exclusively inside your standard browser window. The assistant never prompts for or stores Instagram credentials.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Human In The Loop
            </div>
            <p className="text-slate-400 leading-relaxed">
              To prevent bot spam and account flagging, comments are never submitted automatically. You review, approve, and click to post.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Native Clipboard Action
            </div>
            <p className="text-slate-400 leading-relaxed">
              One-click "Copy & Open Reel" seamlessly copies your chosen comment and opens the exact Reel tab in your browser for instant pasting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
