import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Send, 
  Sparkles, 
  Filter, 
  Tag, 
  MessageSquare, 
  Check, 
  Globe, 
  FileVideo,
  Smile
} from 'lucide-react';

export default function ReviewCommentsView({
  reels,
  selectedReelId,
  onToggleApprove,
  onTogglePost,
  onOpenInstagram
}) {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [approvalFilter, setApprovalFilter] = useState('ALL'); // 'ALL' | 'APPROVED' | 'PENDING'
  const [toastMessage, setToastMessage] = useState('');

  const completedReels = reels.filter((r) => r.status === 'completed' && r.comments && r.comments.length > 0);

  // Available categories
  const categories = ['ALL', ...new Set(completedReels.map((r) => r.category).filter(Boolean))];

  const filteredReels = completedReels.filter((reel) => {
    if (selectedReelId && reel.id === selectedReelId) return true;
    if (categoryFilter !== 'ALL' && reel.category !== categoryFilter) return false;
    if (approvalFilter === 'APPROVED') {
      return reel.comments.some((c) => c.is_approved);
    }
    if (approvalFilter === 'PENDING') {
      return !reel.comments.some((c) => c.is_approved);
    }
    return true;
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleApprove = async (comment) => {
    try {
      const updated = await onToggleApprove(comment.id);
      if (updated?.is_approved) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#a855f7', '#ec4899', '#3b82f6', '#10b981']
        });
        showToast('Comment approved successfully!');
      } else {
        showToast('Comment unapproved.');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCopyAndOpen = async (comment, reelUrl) => {
    try {
      await navigator.clipboard.writeText(comment.text);
      showToast('Comment copied to clipboard! Opening Reel in browser...');
      onOpenInstagram('reel', reelUrl);
    } catch (err) {
      // Fallback
      showToast('Copied to clipboard. Opening Reel...');
      onOpenInstagram('reel', reelUrl);
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'travel': return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'technology': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'food': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'fitness': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'comedy': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
      case 'education': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-purple-600 text-white font-medium text-xs shadow-xl shadow-purple-600/30 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Filter Controls */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Generated Comments Review Studio
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review AI suggestions, approve your preferred tone, and copy with one-click to Instagram.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c === 'ALL' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Approval Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Reels</option>
                <option value="APPROVED" className="bg-slate-900 text-white">Approved Only</option>
                <option value="PENDING" className="bg-slate-900 text-white">Pending Approval</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Reels & Comments Cards */}
      {filteredReels.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel border border-slate-800 text-slate-400 space-y-3">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-white">No comments found matching filters</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Process Reels in the queue to generate natural AI comments based on their actual visual content.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReels.map((reel) => {
            const hasApproved = reel.comments.some((c) => c.is_approved);
            const hasPosted = reel.comments.some((c) => c.is_posted);

            return (
              <div
                key={reel.id}
                className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5"
              >
                {/* Reel Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${getCategoryColor(reel.category)}`}>
                        {reel.category || 'General'}
                      </span>
                      {reel.mood && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          Mood: {reel.mood}
                        </span>
                      )}
                      {reel.language && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          Lang: {reel.language}
                        </span>
                      )}
                      {reel.video_path && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <FileVideo className="w-2.5 h-2.5" /> Video Verified
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white tracking-tight">
                      {reel.title || 'Instagram Reel'}
                    </h4>

                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span className="truncate max-w-md">{reel.url}</span>
                    </div>

                    {reel.visual_summary && (
                      <p className="text-xs text-slate-300 bg-slate-950/50 p-3 rounded-2xl border border-slate-800/80 mt-2 leading-relaxed">
                        <span className="font-semibold text-purple-300">Visual Summary:</span> {reel.visual_summary}
                      </p>
                    )}
                  </div>

                  {/* Reel Quick Launcher */}
                  <button
                    onClick={() => onOpenInstagram('reel', reel.url)}
                    className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shrink-0"
                  >
                    Open Reel <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  </button>
                </div>

                {/* 3 Comments Cards */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    3 AI-Generated Suggestions
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reel.comments.map((comment, idx) => {
                      const isApproved = Boolean(comment.is_approved);
                      const isPosted = Boolean(comment.is_posted);

                      return (
                        <div
                          key={comment.id}
                          className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                            isApproved
                              ? 'bg-purple-950/25 border-purple-500/40 shadow-lg shadow-purple-500/10'
                              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 border border-slate-700">
                                {comment.tone || `Option ${idx + 1}`}
                              </span>
                              {isApproved && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Approved
                                </span>
                              )}
                            </div>

                            <p className="text-sm text-slate-100 font-normal leading-relaxed my-2">
                              "{comment.text}"
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-2">
                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              {/* Approve Button */}
                              <button
                                onClick={() => handleApprove(comment)}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                                  isApproved
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isApproved ? 'Approved' : 'Approve'}
                              </button>

                              {/* Copy & Open Reel in Browser */}
                              <button
                                onClick={() => handleCopyAndOpen(comment, reel.url)}
                                className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-purple-500/20"
                                title="Copy comment to clipboard and launch Reel in browser"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy & Open</span>
                              </button>
                            </div>

                            {/* Mark as Posted */}
                            <div className="flex items-center justify-between pt-1">
                              <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isPosted}
                                  onChange={() => onTogglePost(comment.id)}
                                  className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                                />
                                <span>Posted to Instagram</span>
                              </label>

                              {isPosted && (
                                <span className="text-[10px] text-pink-400 font-semibold flex items-center gap-1">
                                  <Send className="w-2.5 h-2.5" /> Live on IG
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
