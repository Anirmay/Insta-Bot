import React, { useState } from 'react';
import { 
  History, 
  Trash2, 
  Download, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Clock
} from 'lucide-react';

export default function ActivityHistoryView({ logs, onClearLogs, stats }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      return matchMsg || matchDetails;
    }
    return true;
  });

  const exportLogsAsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `reelai_activity_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getLevelBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'success':
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Success
          </span>
        );
      case 'warning':
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> Warning
          </span>
        );
      case 'error':
        return (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5" /> Error
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
            <Info className="w-2.5 h-2.5" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions Bar */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              Activity History & Event Log
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Audited chronological events recorded in local SQLite database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLogsAsJson}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>

            <button
              onClick={onClearLogs}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/30 text-xs font-semibold text-slate-300 hover:text-red-300 flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear History
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs by keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Event Types</option>
              <option value="info" className="bg-slate-900 text-white">Info</option>
              <option value="success" className="bg-slate-900 text-white">Success</option>
              <option value="warning" className="bg-slate-900 text-white">Warning</option>
              <option value="error" className="bg-slate-900 text-white">Error</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Entries List */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-white">No activity records found</div>
            <p className="text-xs text-slate-500">
              Operations like key verification, video analysis, and comment approval will populate this audit trail.
            </p>
          </div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <div className="flex items-start md:items-center gap-3">
                  {getLevelBadge(log.level)}
                  <div className="space-y-0.5">
                    <span className="text-slate-200 font-sans font-medium text-xs">
                      {log.message}
                    </span>
                    {log.details && (
                      <p className="text-[11px] text-slate-400 font-mono">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 shrink-0 self-end md:self-auto">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
