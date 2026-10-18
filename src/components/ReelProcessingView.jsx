import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  Film, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  FileVideo,
  Clock,
  Tag,
  Info,
  Check,
  Eye,
  Activity
} from 'lucide-react';

export default function ReelProcessingView({
  reels = [],
  statusData,
  onStart,
  onPause,
  onResume,
  onStop,
  onSetTarget,
  onAddReel,
  onBatchAddReels,
  onRetryReel,
  onUploadReelVideo,
  onDeleteReel,
  onSeedSamples,
  onOpenInstagram,
  setCurrentView,
  setSelectedReelId
}) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'batch'
  const [singleUrl, setSingleUrl] = useState('');
  const [singleTitle, setSingleTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchText, setBatchText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingReelId, setUploadingReelId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fileInputRefs = useRef({});

  const [targetInput, setTargetInput] = useState(statusData?.targetReels || 50);

  const engineStatus = statusData?.status || 'idle';
  const currentStep = statusData?.currentStep || 'Ready';
  const currentReelUrl = statusData?.currentReelUrl || '';

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!singleUrl.trim() && !selectedFile) {
      setFormError('Please provide either an Instagram Reel URL or upload a video file.');
      return;
    }

    try {
      setIsSubmitting(true);
      let payload;
      if (selectedFile) {
        payload = new FormData();
        payload.append('video', selectedFile);
        if (singleUrl.trim()) payload.append('url', singleUrl.trim());
        if (singleTitle.trim()) payload.append('title', singleTitle.trim());
      } else {
        payload = {
          url: singleUrl.trim(),
          title: singleTitle.trim() || undefined
        };
      }

      const res = await onAddReel(payload);
      if (selectedFile) {
        setFormSuccess('Video uploaded! Ready for multimodal frame analysis.');
      } else {
        setFormSuccess('Reel URL saved! Instagram restricts direct CDN scraping; please upload the video file below to enable visual frame analysis.');
      }
      setSingleUrl('');
      setSingleTitle('');
      setSelectedFile(null);
    } catch (err) {
      setFormError(err.message || 'Failed to add Reel. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setFormError('Please enter at least one Reel URL.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onBatchAddReels(lines);
      setFormSuccess(`Imported ${res.added} URLs (${res.skipped} duplicates skipped). Please attach video files to perform genuine frame analysis.`);
      setBatchText('');
    } catch (err) {
      setFormError(err.message || 'Failed to import batch URLs. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachVideo = async (reelId, file) => {
    if (!file) return;
    try {
      setUploadingReelId(reelId);
      setFormError('');
      setFormSuccess('');
      await onUploadReelVideo(reelId, file);
      setFormSuccess(`Video attached to Reel! Status updated to pending analysis.`);
    } catch (err) {
      setFormError(`Failed to attach video: ${err.message}`);
    } finally {
      setUploadingReelId(null);
    }
  };

  const handleSeedSamples = async () => {
    try {
      setFormError('');
      setFormSuccess('');
      const res = await onSeedSamples();
      setFormSuccess(`Loaded ${res?.count || 4} sample Reel links. Attach video files to analyze them!`);
    } catch (err) {
      setFormError(err.message || 'Failed to load sample Reels. Please check backend connection.');
    }
  };

  const handleTargetSave = (e) => {
    e.preventDefault();
    onSetTarget(targetInput);
  };

  const handleViewComments = (reelId) => {
    if (setSelectedReelId) setSelectedReelId(reelId);
    setCurrentView('review');
  };

  return (
    <div className="space-y-6">
      {/* Engine Controls & Target Header */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Film className="w-5 h-5 text-purple-400" />
              Reel Processing Engine & Settings
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Genuine Multimodal Video Analysis: Samples beginning, middle, and end frames using FFmpeg.
            </p>
          </div>

          {/* Engine Controls */}
          <div className="flex items-center gap-2">
            {engineStatus === 'running' ? (
              <button
                onClick={onPause}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Pause className="w-3.5 h-3.5" /> Pause Engine
              </button>
            ) : engineStatus === 'paused' ? (
              <button
                onClick={onResume}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Resume Processing
              </button>
            ) : (
              <button
                onClick={onStart}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start Processing
              </button>
            )}

            <button
              onClick={onStop}
              disabled={engineStatus === 'idle' || engineStatus === 'stopped'}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </button>
          </div>
        </div>

        {/* Live Step Status */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
              Live Processing Status
            </span>
            <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
              {engineStatus === 'running' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
              <span>{currentStep}</span>
            </div>
            {currentReelUrl && (
              <div className="text-slate-400 font-mono text-[11px] truncate max-w-lg">
                Current URL: {currentReelUrl}
              </div>
            )}
          </div>

          <form onSubmit={handleTargetSave} className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <span className="text-slate-400">Target Reels:</span>
            <input
              type="number"
              min="1"
              max="500"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-16 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono text-center focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-all"
            >
              Save
            </button>
          </form>
        </div>
      </div>

      {/* Educational Callout: Real Video Analysis Requirement */}
      <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <span className="font-bold text-white">How ReelAI performs genuine visual inspection:</span>
          <p className="text-slate-300">
            Instagram protects video CDNs behind authentication walls, which prevents automated scraping. To ensure Gemini generates 
            accurate, non-generic comments grounded in reality, ReelAI uses <strong>FFmpeg to extract visual frames</strong> from the beginning, 
            middle, and end of the Reel video (MP4, MOV, WEBM) and sends them to Gemini. Reels without video files are held in <em>Awaiting Video</em> status.
          </p>
        </div>
      </div>

      {/* Add Reels Input Section */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'single'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Add Reel & Upload Video
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'batch'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Batch Import URLs
            </button>
          </div>

          <button
            onClick={handleSeedSamples}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-purple-300 font-medium flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Load Sample Reel Links
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}

        {/* Single Add Form */}
        {activeTab === 'single' && (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Instagram Reel URL
                </label>
                <input
                  type="url"
                  placeholder="https://www.instagram.com/reel/C3b4xyZ.../"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Reel Title or Topic (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Morning workout routine, Cooking tutorial"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Video File Upload Dropzone */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Attach Reel Video File (MP4, MOV, or WEBM) for Genuine Visual AI Analysis
              </label>
              <div className="p-5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-900/40 text-center transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  {selectedFile ? (
                    <>
                      <FileVideo className="w-9 h-9 text-emerald-400" />
                      <div className="text-sm font-bold text-white">{selectedFile.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for FFmpeg frame extraction
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-purple-400" />
                      <div className="text-sm font-medium text-slate-200">
                        Drag & drop Reel video file here, or click to browse
                      </div>
                      <div className="text-xs text-slate-500">
                        Supports MP4, MOV, and WEBM. FFmpeg will sample frames at beginning, middle, and end.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/25 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {isSubmitting ? 'Adding...' : selectedFile ? 'Add Reel & Video to Queue' : 'Save URL (Requires Video Upload)'}
              </button>
            </div>
          </form>
        )}

        {/* Batch Add Form */}
        {activeTab === 'batch' && (
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Paste Multiple Reel URLs (One URL per line)
              </label>
              <textarea
                rows={5}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"https://www.instagram.com/reel/C3b4xyZ_1/\nhttps://www.instagram.com/reel/D4k9mnP_2/\nhttps://www.instagram.com/reel/E7p2qrS_3/"}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Note: Imported URLs will be placed in <em>Awaiting Video</em> status. You can upload each Reel's video file directly from the queue.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/25 disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                {isSubmitting ? 'Importing...' : 'Import URLs to Queue'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Queue List Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h4 className="font-bold text-white text-base">Reels Queue & Video Inventory</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {reels.length} total Reels registered ({reels.filter(r => r.status === 'completed').length} visually analyzed)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Analyzed: {reels.filter(r => r.status === 'completed').length}
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Ready: {reels.filter(r => r.status === 'pending' && r.video_path).length}
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Awaiting Video: {reels.filter(r => r.status === 'awaiting_video' || (!r.video_path && r.status !== 'completed')).length}
            </span>
          </div>
        </div>

        {reels.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-3">
            <Film className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">Your queue is currently empty</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add Reel links and upload video files above to begin genuine visual AI comment generation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reels.map((reel) => {
              const isCompleted = reel.status === 'completed';
              const isAnalyzing = reel.status === 'analyzing';
              const isError = reel.status === 'error';
              const isAwaitingVideo = reel.status === 'awaiting_video' || (!reel.video_path && !isCompleted);
              const isPending = reel.status === 'pending' && Boolean(reel.video_path);

              const hasVideo = Boolean(reel.video_path);
              const framesCount = reel.frames_count || 0;

              return (
                <div
                  key={reel.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-5 ${
                    isCompleted
                      ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      : isAnalyzing
                      ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10'
                      : isAwaitingVideo
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : isError
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-sky-500/5 border-sky-500/30'
                  }`}
                >
                  <div className="space-y-2.5 max-w-2xl flex-1">
                    {/* Status Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* State 1: URL submitted, video not analyzed */}
                      {isAwaitingVideo && (
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> URL Submitted • Video Not Analyzed
                        </span>
                      )}

                      {/* State 2: Video uploaded, analysis pending */}
                      {isPending && (
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                          <FileVideo className="w-3 h-3" /> Video Uploaded • Analysis Pending
                        </span>
                      )}

                      {/* State 3: Analyzing */}
                      {isAnalyzing && (
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-500/40 flex items-center gap-1 animate-pulse">
                          <Activity className="w-3 h-3 animate-spin" /> Extracting Frames & Analyzing
                        </span>
                      )}

                      {/* State 4: Video successfully analyzed */}
                      {isCompleted && (
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Video Successfully Analyzed
                        </span>
                      )}

                      {/* State 5: Analysis failed */}
                      {isError && (
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Analysis Failed
                        </span>
                      )}

                      {/* Video Content Received Indicator */}
                      {hasVideo ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-950/60 text-sky-300 border border-sky-800/60 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-sky-400" /> Video Received ({reel.video_filename || 'MP4'})
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-300/80 px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/40">
                          No Video File
                        </span>
                      )}

                      {/* Frames Count Badge */}
                      {framesCount > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" /> {framesCount} Frames Analyzed
                        </span>
                      )}

                      {/* Category Badge */}
                      {reel.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" /> {reel.category}
                        </span>
                      )}

                      {/* Mood Badge */}
                      {reel.mood && (
                        <span className="text-[10px] text-slate-300 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                          Mood: {reel.mood}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-white">
                      {reel.title || 'Instagram Reel'}
                    </div>

                    <div className="text-xs text-slate-400 font-mono truncate max-w-xl">
                      {reel.url}
                    </div>

                    {/* Visual Analysis Results (Grounding) */}
                    {isCompleted && (
                      <div className="space-y-2 mt-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                        {reel.visual_summary && (
                          <div>
                            <span className="font-semibold text-purple-300">Visual Summary: </span>
                            <span className="text-slate-200">{reel.visual_summary}</span>
                          </div>
                        )}
                        {reel.main_subject && (
                          <div className="text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Main Subject: </span>
                            {reel.main_subject}
                          </div>
                        )}
                        {reel.actions && (
                          <div className="text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Observable Actions: </span>
                            {reel.actions}
                          </div>
                        )}

                        {/* Generated Comments Preview */}
                        {reel.comments && reel.comments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                              3 Grounded AI Comments:
                            </span>
                            <div className="space-y-1">
                              {reel.comments.slice(0, 3).map((c, idx) => (
                                <div key={c.id || idx} className="text-xs bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 text-slate-200 flex items-start justify-between gap-2">
                                  <span>"{c.text}"</span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 shrink-0">
                                    {c.tone || `Option ${idx + 1}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Awaiting Video Prompt */}
                    {isAwaitingVideo && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Direct video access is restricted by Instagram. Please upload the Reel video file to analyze.</span>
                        </div>
                        <div>
                          <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm"
                            ref={(el) => (fileInputRefs.current[reel.id] = el)}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAttachVideo(reel.id, file);
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingReelId === reel.id}
                            onClick={() => fileInputRefs.current[reel.id]?.click()}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {uploadingReelId === reel.id ? 'Uploading Video...' : 'Upload Reel Video (MP4/MOV/WEBM)'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {reel.error_message && !isAwaitingVideo && (
                      <p className="text-xs text-red-300 bg-red-950/40 p-2.5 rounded-xl border border-red-800/40">
                        Error: {reel.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions Right Side */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => onOpenInstagram('reel', reel.url)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                      title="Open Reel in Default Browser"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    {isCompleted && (
                      <button
                        onClick={() => handleViewComments(reel.id)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        Review Comments
                      </button>
                    )}

                    {(isError || isAwaitingVideo) && hasVideo && (
                      <button
                        onClick={() => onRetryReel(reel.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteReel(reel.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all border border-slate-700"
                      title="Delete Reel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
