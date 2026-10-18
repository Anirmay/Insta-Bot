import React from 'react';
import { 
  LayoutDashboard, 
  Film, 
  MessageSquareCheck, 
  KeyRound, 
  History,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import Instagram from './InstagramIcon.jsx';

export default function Sidebar({ currentView, setCurrentView, stats, keys, status }) {
  const activeKey = keys.find(k => k.is_active);
  const quotaAlert = keys.some(k => k.status === 'quota_exhausted');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'instagram', label: 'Instagram Session', icon: Instagram },
    { id: 'queue', label: 'Reels & Videos', icon: Film, badge: stats?.pendingCount > 0 ? stats.pendingCount : null },
    { id: 'review', label: 'Review Comments', icon: MessageSquareCheck, badge: stats?.totalCommentsApproved > 0 ? `${stats.totalCommentsApproved} approved` : null },
    { id: 'gemini', label: 'Gemini AI Config', icon: KeyRound, alert: quotaAlert || !activeKey },
    { id: 'logs', label: 'Activity History', icon: History },
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d]/90 border-r border-slate-800/80 flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                ReelAI
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Assistant
                </span>
              </h1>
              <p className="text-xs text-slate-400">Gemini Video Copilot</p>
            </div>
          </div>
        </div>

        {/* Engine Mini Status */}
        <div className="px-4 py-3 mx-3 my-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              status === 'running' ? 'bg-emerald-400 animate-ping' :
              status === 'paused' ? 'bg-amber-400' :
              status === 'completed' ? 'bg-purple-400' : 'bg-slate-500'
            }`} />
            <span className="font-medium text-slate-300 capitalize">{status || 'Idle'}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {stats?.totalProcessed || 0} reels done
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/20 to-purple-800/10 text-purple-300 border border-purple-500/30 shadow-sm shadow-purple-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.alert && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Attention needed" />
                )}
                {item.badge && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Security & OS Vault Badge */}
      <div className="p-4 border-t border-slate-800/60">
        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Secure OS Credential Vault</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            API keys encrypted with Windows DPAPI / machine keys. Zero Instagram passwords stored.
          </p>
        </div>
      </div>
    </aside>
  );
}
