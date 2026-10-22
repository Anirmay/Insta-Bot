import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Upload, 
  Film, 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  FileVideo,
  FileText,
  Clock,
  Tag,
  Eye,
  Activity,
  AlertTriangle,
  HelpCircle,
  Camera,
  LogIn,
  DownloadCloud,
  Check
} from 'lucide-react';

export default function ReelProcessingView({
  reels,
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

  const [targetInput, setTargetInput] = useState(statusData?.targetReels || 50);

  const engineStatus = statusData?.status || 'idle';
  const currentStep = statusData?.currentStep || 'Ready';
  const currentReelUrl = statusData?.currentReelUrl || '';
  const isInstagramLoggedIn = Boolean(statusData?.instagramSession?.isLoggedIn);

  const inlineFileInputRefs = useRef({});

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!singleUrl.trim() && !selectedFile) {
      setFormError('Please enter an Instagram Reel URL (e.g., https://www.instagram.com/reel/C3b4xyZ...).');
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

      await onAddReel(payload);
      setFormSuccess('Reel URL added to queue! Video stream will be retrieved automatically when processing starts.');
      setSingleUrl('');
      setSingleTitle('');
      setSelectedFile(null);
    } catch (err) {
      setFormError(err.message || 'Failed to add Reel.');
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
      setFormSuccess(`Imported ${res.added} Reel URLs into the processing queue (${res.skipped} skipped or duplicates). Ready for automated sequential analysis.`);
      setBatchText('');
    } catch (err) {
      setFormError(err.message || 'Failed to import batch URLs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInlineVideoUpload = async (reelId, file) => {
    if (!file) return;
    try {
      setUploadingReelId(reelId);
      setFormError('');
      setFormSuccess('');
      await onUploadReelVideo(reelId, file);
      setFormSuccess('Video file uploaded! Reel is now pending genuine visual frame analysis.');
    } catch (err) {
      setFormError(`Failed to upload video: ${err.message}`);
    } finally {
      setUploadingReelId(null);
    }
  };

  const handleSeedSamples = async () => {
    try {
      setFormError('');
      setFormSuccess('');
      const res = await onSeedSamples();
      setFormSuccess(`Loaded ${res?.count || 4} verified sample Reels with full visual frame records!`);
    } catch (err) {
      setFormError(err.message || 'Failed to load sample Reels.');
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
              Reel Processing Engine & Automated Video Analysis
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Processes queued Reel URLs sequentially: automatically retrieves accessible video streams, samples multi-scene frames with FFmpeg, and analyzes visual content using Gemini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {engineStatus === 'idle' || engineStatus === 'stopped' || engineStatus === 'completed' ? (
              <button
                onClick={onStart}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Processing Queue
              </button>
            ) : null}

            {engineStatus === 'running' && (
              <button
                onClick={onPause}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                Pause Processing
              </button>
            )}

            {engineStatus === 'paused' && (
              <button
                onClick={onResume}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Resume Processing
              </button>
            )}

            {(engineStatus === 'running' || engineStatus === 'paused') && (
              <button
                onClick={onStop}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Current Live Step Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              engineStatus === 'running' ? 'bg-emerald-400 animate-ping' :
              engineStatus === 'paused' ? 'bg-amber-400' : 'bg-slate-500'
            }`} />
            <span className="text-slate-400">Current Task:</span>
            <span className="font-semibold text-white truncate max-w-xl">{currentStep}</span>
          </div>

          <form onSubmit={handleTargetSave} className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <label className="text-slate-400 text-[11px]">Batch Target:</label>
            <input
              type="number"
              min="1"
              max="500"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-16 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white text-center font-mono focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700"
            >
              Save
            </button>
          </form>
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
              Paste Reel Link (Link-Only Direct Analysis)
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'batch'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Batch Import Multiple URLs
            </button>
          </div>

          <button
            onClick={handleSeedSamples}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-purple-300 font-medium flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Load Realistic Sample Reels
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-pink-950/30 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-3">
          <Camera className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-purple-300">Direct Link-Only Video Analysis:</span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              No manual video downloads or uploads needed! Simply paste the Instagram Reel link. When processing starts, ReelAI retrieves the accessible video stream directly through your connected Instagram session, extracts representative visual frames using FFmpeg, and inspects actual scene details with Gemini.
            </p>
          </div>
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
                  Instagram Reel URL <span className="text-purple-400">*</span>
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
                  Optional Label or Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mountain sunrise hike in Switzerland"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Optional Manual Video Upload Accordion */}
            <details className="text-xs text-slate-400 group">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200 flex items-center gap-1.5 select-none font-medium">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Optional: Have a local video file instead? Click to attach (.mp4, .mov, .webm)
              </summary>
              <div className="mt-3 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-2 text-[11px] text-emerald-400 font-mono">
                    Attached file: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </details>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/25 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {isSubmitting ? 'Adding...' : 'Add Reel to Queue'}
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
                Each link will be safely normalized and queued for sequential automated video retrieval and Gemini visual frame analysis.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/25 disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                {isSubmitting ? 'Importing...' : 'Import Batch URLs'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Queue List Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-white text-base">Reels Queue & Video Inventory</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {reels.length} total registered ({reels.filter(r => r.status === 'completed').length} analyzed with visual frames)
            </p>
          </div>
        </div>

        {reels.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-3">
            <Film className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-medium text-slate-300">Your queue is currently empty</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Paste Instagram Reel links above or load realistic sample Reels to inspect frame-grounded comment generation.
            </p>
            <button
              onClick={handleSeedSamples}
              className="mt-2 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold inline-flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> Load Sample Verified Reels
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {reels.map((reel) => {
              const isCompleted = reel.status === 'completed';
              const isAnalyzing = reel.status === 'analyzing';
              const isExtracting = reel.status === 'extracting_frames';
              const isRetrieving = reel.status === 'retrieving_video';
              const isCheckingAccess = reel.status === 'checking_access';
              const isVideoRetrieved = reel.status === 'video_retrieved';
              const isAuthRequired = reel.status === 'auth_required';
              const isNotAccessible = reel.status === 'not_accessible';
              const isError = reel.status === 'error';
              const isPending = reel.status === 'pending';

              const hasVideo = Boolean(reel.video_path);
              const isUploadingThis = uploadingReelId === reel.id;

              return (
                <div
                  key={reel.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                    isAnalyzing || isExtracting || isRetrieving || isCheckingAccess
                      ? 'bg-purple-500/10 border-purple-500/40'
                      : isError || isNotAccessible
                      ? 'bg-red-500/10 border-red-500/30'
                      : isAuthRequired
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : isCompleted
                      ? 'bg-slate-900/60 border-emerald-500/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2 max-w-2xl flex-1">
                    {/* Truthful 10-State Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isCompleted ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Successfully Analyzed
                        </span>
                      ) : isAnalyzing ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse flex items-center gap-1">
                          <Eye className="w-3 h-3 text-purple-400" /> AI Analysis in Progress
                        </span>
                      ) : isExtracting ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse flex items-center gap-1">
                          <Camera className="w-3 h-3 text-indigo-400" /> Extracting Frames
                        </span>
                      ) : isVideoRetrieved ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          <DownloadCloud className="w-3 h-3 text-cyan-400" /> Video Content Retrieved
                        </span>
                      ) : isRetrieving ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" /> Retrieving Video
                        </span>
                      ) : isCheckingAccess ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                          <Activity className="w-3 h-3 text-amber-400" /> Checking Reel Access
                        </span>
                      ) : isAuthRequired ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <LogIn className="w-3 h-3 text-rose-400" /> Authentication Required
                        </span>
                      ) : isNotAccessible ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-orange-400" /> Reel Not Accessible
                        </span>
                      ) : isPending ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" /> URL Added
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400" /> Analysis Failed
                        </span>
                      )}

                      {/* Video Duration */}
                      {reel.video_duration > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-slate-400" /> {Math.round(reel.video_duration)}s Video
                        </span>
                      )}

                      {/* Frames Count */}
                      {reel.frames_count > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Camera className="w-2.5 h-2.5" /> {reel.frames_count} Visual Frames Extracted
                        </span>
                      )}

                      {reel.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" /> {reel.category}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-white">
                      {reel.title || 'Instagram Reel'}
                    </div>

                    <div className="text-xs text-slate-400 font-mono truncate max-w-xl">
                      {reel.url}
                    </div>

                    {/* Authentication Required Action Callout */}
                    {isAuthRequired && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                        <div className="text-xs text-rose-200 flex items-start gap-1.5 leading-relaxed">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            Instagram requires an authenticated session to access this Reel. Please connect your Instagram account in the Instagram Session Hub.
                          </span>
                        </div>
                        <button
                          onClick={() => setCurrentView('instagram')}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Go to Instagram Session Hub
                        </button>
                      </div>
                    )}

                    {/* Reel Not Accessible Explanation */}
                    {isNotAccessible && (
                      <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-500/40 text-xs text-orange-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                          <span>Content Not Available on Instagram</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {reel.error_message || 'Instagram reported that this Reel is unavailable, private, or deleted.'}
                        </p>
                      </div>
                    )}

                    {/* Visual Grounded Summary & Details */}
                    {reel.visual_summary && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                        <div>
                          <span className="font-semibold text-purple-300">Visual Summary:</span>{' '}
                          <span className="leading-relaxed">{reel.visual_summary}</span>
                        </div>
                        {reel.main_subject && (
                          <div>
                            <span className="font-semibold text-sky-300">Main Subject:</span>{' '}
                            <span>{reel.main_subject}</span>
                          </div>
                        )}
                        {reel.actions && (
                          <div>
                            <span className="font-semibold text-emerald-300">Observable Actions:</span>{' '}
                            <span>{reel.actions}</span>
                          </div>
                        )}
                        {reel.mood && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                            <span>Mood: <strong className="text-slate-300">{reel.mood}</strong></span>
                            {reel.language && <span>Language: <strong className="text-slate-300">{reel.language}</strong></span>}
                          </div>
                        )}
                      </div>
                    )}

                    {reel.error_message && !isAuthRequired && !isNotAccessible && (
                      <p className="text-xs text-red-300 bg-red-950/40 p-2.5 rounded-xl border border-red-800/40">
                        Error: {reel.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-start shrink-0">
                    <button
                      onClick={() => onOpenInstagram('reel', reel.url)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
                      title="Open Reel on Instagram"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    {isCompleted && (
                      <button
                        onClick={() => handleViewComments(reel.id)}
                        className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-purple-500/20"
                      >
                        View 3 Comments
                      </button>
                    )}

                    {(isError || isNotAccessible || isAuthRequired) && (
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
