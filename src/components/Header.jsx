import React from 'react';
import { 
  Sparkles, 
  KeyRound, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';
import Instagram from './InstagramIcon.jsx';

export default function Header({ 
  currentView, 
  statusData, 
  keys, 
  onRefresh, 
  isRefreshing,
  onOpenInstagram 
}) {
  const titles = {
    dashboard: { title: 'Assistant Dashboard', desc: 'Real-time overview of Reel analysis, stats, and engine control' },
    instagram: { title: 'Instagram Session Hub', desc: 'Safe browser-integrated navigation & terms-compliant workflows' },
    queue: { title: 'Reels Processing Queue', desc: 'Manage Reel URLs, upload video files, and monitor AI analysis' },
    review: { title: 'Comment Review Studio', desc: 'Approve AI-generated comments and copy directly to Instagram' },
    gemini: { title: 'Google Gemini AI Configuration', desc: 'Manage API keys with OS credential vault & configure models' },
    logs: { title: 'Activity Logs & History', desc: 'Audited session event history, error tracking, and analytics' }
  };

  const activeKey = keys.find(k => k.is_active);
  const isLoggedIn = Boolean(statusData?.instagramSession?.isLoggedIn);
  const currentInfo = titles[currentView] || { title: 'ReelAI Assistant', desc: '' };

  return (
    <header className="h-20 border-b border-slate-800/80 bg-[#0a0f1d]/50 backdrop-blur-md px-8 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">{currentInfo.title}</h2>
        <p className="text-xs text-slate-400">{currentInfo.desc}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Instagram Browser Status */}
        <div 
          onClick={() => onOpenInstagram('homepage')}
          className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
            isLoggedIn 
              ? 'bg-pink-500/10 border-pink-500/30 text-pink-300 hover:bg-pink-500/20' 
              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
          title="Click to open Instagram in default browser"
        >
          <Instagram className="w-3.5 h-3.5 text-pink-400" />
          <span>{isLoggedIn ? 'Instagram Connected' : 'Browser Session'}</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </div>

        {/* Gemini Active Model */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-medium font-mono">{statusData?.selectedModel || 'gemini-3.8-flash'}</span>
        </div>

        {/* Active Key Status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
          activeKey 
            ? activeKey.status === 'quota_exhausted'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <KeyRound className="w-3.5 h-3.5" />
          <span>{activeKey ? activeKey.masked_key : 'No Key Active'}</span>
        </div>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          title="Refresh statistics & queue"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}
