import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Film, 
  CheckCircle2, 
  Send, 
  MessageSquare, 
  Video, 
  ExternalLink, 
  AlertTriangle, 
  Sparkles,
  ArrowRight,
  Settings,
  Flame,
  Check
} from 'lucide-react';
import Instagram from './InstagramIcon.jsx';

export default function DashboardView({
  statusData,
  keys,
  onStart,
  onPause,
  onResume,
  onStop,
  onSetTarget,
  onOpenInstagram,
  onUpdateSession,
  onSeedSamples,
  setCurrentView
}) {
  const [targetInput, setTargetInput] = useState(statusData?.targetReels || 50);
  const [customReelUrl, setCustomReelUrl] = useState('');
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);

  const stats = statusData?.stats || {};
  const processed = stats.totalProcessed || 0;
  const target = statusData?.targetReels || 50;
  const progressPercent = Math.min(100, Math.round((processed / target) * 100));

  const engineStatus = statusData?.status || 'idle';
  const currentStep = statusData?.currentStep || 'Ready to start';
  const currentReelUrl = statusData?.currentReelUrl || '';

  const activeKey = keys.find(k => k.is_active);
  const quotaExhausted = activeKey && activeKey.status === 'quota_exhausted';
  const isLoggedIn = Boolean(statusData?.instagramSession?.isLoggedIn);

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    setIsUpdatingTarget(true);
    await onSetTarget(targetInput);
    setIsUpdatingTarget(false);
  };

  const handleOpenCustomReel = (e) => {
    e.preventDefault();
    if (customReelUrl.trim()) {
      onOpenInstagram('reel', customReelUrl.trim());
      setCustomReelUrl('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Quota Exhaustion / Key Alert Banner */}
      {quotaExhausted && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-300 text-sm">Gemini API Quota Limit Reached</h4>
              <p className="text-xs text-amber-200/80 mt-0.5">
                The current active key has exceeded its usage quota. Processing has paused automatically. Please manually switch to an authorized backup key in API Settings.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('gemini')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shrink-0 transition-all flex items-center gap-1.5"
          >
            Manage Keys <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!activeKey && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-purple-300 text-sm">Welcome to ReelAI Assistant</h4>
              <p className="text-xs text-purple-200/80 mt-0.5">
                To start generating natural AI comments from Reels, configure your Google Gemini API key securely.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('gemini')}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shrink-0 transition-all flex items-center gap-1.5"
          >
            Add API Key <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Processed */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Reels Processed</span>
            <Film className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{processed}</div>
          <div className="text-[11px] text-slate-400 mt-1">Target: {target}</div>
        </div>

        {/* Total Videos Analyzed */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Videos Analyzed</span>
            <Video className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalVideosAnalyzed || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Multimodal vision</div>
        </div>

        {/* Comments Generated */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Comments Created</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalCommentsGenerated || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">3 suggestions / reel</div>
        </div>

        {/* Comments Approved */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>User Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalCommentsApproved || 0}</div>
          <div className="text-[11px] text-emerald-400 mt-1">Human reviewed</div>
        </div>

        {/* Comments Posted */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Posted by User</span>
            <Send className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalCommentsPosted || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Manual submission</div>
        </div>

        {/* Processing Status */}
        <div className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Engine Status</span>
            <span className={`w-2.5 h-2.5 rounded-full ${
              engineStatus === 'running' ? 'bg-emerald-400 animate-ping' :
              engineStatus === 'paused' ? 'bg-amber-400' :
              engineStatus === 'completed' ? 'bg-purple-400' : 'bg-slate-500'
            }`} />
          </div>
          <div className="text-lg font-bold text-white capitalize truncate">{engineStatus}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            {quotaExhausted ? 'Quota alert' : (statusData?.selectedModel || 'gemini-3.8-flash')}
          </div>
        </div>
      </div>

      {/* Target Progress Bar & Goal Setting */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">Processing Target</h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                {processed} / {target} Reels ({progressPercent}%)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automated analysis pauses once the configured limit is fulfilled.
            </p>
          </div>

          {/* Quick Target Form */}
          <form onSubmit={handleSaveTarget} className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Target limit:</label>
            <input
              type="number"
              min="1"
              max="500"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-20 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={isUpdatingTarget}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-all border border-slate-700"
            >
              Update
            </button>
          </form>
        </div>

        {/* Progress Track */}
        <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800/80 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 transition-all duration-500 shadow-sm shadow-purple-500/30"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Engine Controls & Current Step Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls & Active Step (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl glass-panel border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Processing Engine Controls</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Controls queue evaluation and adherence to Instagram and API rate limits.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {engineStatus === 'running' ? (
                <button
                  onClick={onPause}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              ) : engineStatus === 'paused' ? (
                <button
                  onClick={onResume}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Resume
                </button>
              ) : (
                <button
                  onClick={onStart}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-500/25"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Assistant
                </button>
              )}

              <button
                onClick={onStop}
                disabled={engineStatus === 'idle' || engineStatus === 'stopped'}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </button>
            </div>
          </div>

          {/* Current Step Banner */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-purple-400">
                Current Processing Step
              </span>
              <span className="font-mono text-[11px]">
                {engineStatus === 'running' ? 'Active' : engineStatus}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
              {engineStatus === 'running' && (
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              )}
              <span>{currentStep}</span>
            </div>

            {currentReelUrl && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate max-w-[80%] font-mono">
                  {currentReelUrl}
                </span>
                <button
                  onClick={() => onOpenInstagram('reel', currentReelUrl)}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Queue Summary / Demo Seed */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">
              <span className="text-slate-200 font-semibold">{stats.pendingCount || 0}</span> Reels remaining in queue
            </div>

            <button
              onClick={onSeedSamples}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Load 4 Realistic Demo Reels
            </button>
          </div>
        </div>

        {/* Instagram Browser Hub Card (1 col) */}
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/20">
                <Instagram className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Instagram Session</h3>
                <p className="text-xs text-slate-400">Safe browser navigation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Launch Instagram in your standard browser to authenticate safely. Your passwords are never collected.
            </p>

            <div className="space-y-2.5 mt-4">
              <button
                onClick={() => onOpenInstagram('homepage')}
                className="w-full py-2 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 flex items-center justify-between transition-all"
              >
                <span>Open Instagram Homepage</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => onOpenInstagram('reels')}
                className="w-full py-2 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 flex items-center justify-between transition-all"
              >
                <span>Open Instagram Reels Feed</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Browser Login Status:</span>
              <button
                onClick={() => onUpdateSession(!isLoggedIn)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                  isLoggedIn 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isLoggedIn ? <Check className="w-3 h-3" /> : null}
                {isLoggedIn ? 'Verified Logged In' : 'Click to Verify'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
