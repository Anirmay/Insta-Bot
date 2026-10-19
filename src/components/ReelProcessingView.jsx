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
  Camera
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

  const inlineFileInputRefs = useRef({});

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!singleUrl.trim() && !selectedFile) {
      setFormError('Please provide an Instagram Reel URL or upload a video file.');
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
      if (res?.reel?.status === 'needs_video') {
        setFormSuccess('Reel URL registered! As direct Instagram downloading is restricted, please attach the video file below for frame analysis.');
      } else {
        setFormSuccess('Reel with video file queued for genuine visual frame analysis!');
      }
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
      setFormSuccess(`Imported ${res.added} Reel URLs (${res.skipped} duplicates skipped). Please attach video files to each Reel to enable visual AI analysis.`);
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
              Reel Processing Engine & Frame Analysis
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Processes queued Reels with FFmpeg multi-frame extraction and Google Gemini multimodal visual inspection.
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
              Add Single Reel (With Video Upload)
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
            Load Sample Verified Reels
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2.5">
          <Camera className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-indigo-300">Genuine Video Analysis Policy:</span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              ReelAI extracts actual representative frames across the video (opening, midpoint, climax, and resolution) using FFmpeg and passes high-resolution frame images directly to Gemini. Because Instagram blocks unauthenticated scrapers, attach your video file (.mp4, .mov, or .webm) so ReelAI never fabricates comments.
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
                  placeholder="e.g., Mountain sunrise hike in Switzerland"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Video File Upload Dropzone */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Attach Video File for Multi-Frame Extraction (Permitted Method - MP4, MOV, WEBM)
              </label>
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-900/40 text-center transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  {selectedFile ? (
                    <>
                      <FileVideo className="w-8 h-8 text-emerald-400" />
                      <div className="text-xs font-bold text-white">{selectedFile.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for FFmpeg frame extraction & Gemini inspection
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-purple-400" />
                      <div className="text-xs font-medium text-slate-200">
                        Drag & drop Reel video file here, or click to browse
                      </div>
                      <div className="text-[11px] text-slate-500">
                        FFmpeg will sample 6 frames across the beginning, middle, and end for Gemini visual grounding
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
                Note: Imported URLs will request video file attachment before running visual analysis to prevent generic or hallucinated comments.
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
              Add Reel links above, attach video files, or load the realistic sample Reels to inspect frame-grounded comment generation.
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
              const isError = reel.status === 'error';
              const isNeedsVideo = reel.status === 'needs_video';
              const isPending = reel.status === 'pending';
              const hasVideo = Boolean(reel.video_path);

              const isUploadingThis = uploadingReelId === reel.id;

              return (
                <div
                  key={reel.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                    isAnalyzing
                      ? 'bg-purple-500/10 border-purple-500/40'
                      : isError
                      ? 'bg-red-500/10 border-red-500/30'
                      : isNeedsVideo
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : isCompleted
                      ? 'bg-slate-900/60 border-emerald-500/20'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2 max-w-2xl flex-1">
                    {/* Status Badges Header */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Precise Status Badge */}
                      {isCompleted ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Video Successfully Analyzed
                        </span>
                      ) : isAnalyzing ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse flex items-center gap-1">
                          <Eye className="w-3 h-3 text-purple-400" /> Analyzing Visual Frames...
                        </span>
                      ) : isNeedsVideo ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> URL Submitted, Video Not Analyzed
                        </span>
                      ) : isPending ? (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" /> Video Uploaded, Analysis Pending
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400" /> Analysis Failed
                        </span>
                      )}

                      {/* Video Content Received Indicator */}
                      {hasVideo ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                          <FileVideo className="w-2.5 h-2.5" /> Video Content Received ({reel.video_filename || 'video file'})
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300/90 border border-amber-500/30">
                          Video File Not Received
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

                    {/* Needs Video File Upload Callout */}
                    {isNeedsVideo && (
                      <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-2">
                        <div className="text-xs text-amber-200 flex items-start gap-1.5 leading-relaxed">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>
                            Direct video access from Instagram URL requires authentication. Please upload the Reel video file (.mp4, .mov, .webm) to perform real frame-by-frame AI analysis.
                          </span>
                        </div>
                        <div>
                          <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm"
                            ref={(el) => (inlineFileInputRefs.current[reel.id] = el)}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleInlineVideoUpload(reel.id, file);
                            }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={isUploadingThis}
                            onClick={() => inlineFileInputRefs.current[reel.id]?.click()}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {isUploadingThis ? 'Uploading Video...' : 'Upload Reel Video File (.mp4, .mov, .webm)'}
                          </button>
                        </div>
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

                    {reel.error_message && !isNeedsVideo && (
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
                      title="Open Reel in Default Browser"
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

                    {isError && (
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
