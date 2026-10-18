import React, { useState, useEffect, useCallback } from 'react';
import api from './api.js';

import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import DashboardView from './components/DashboardView.jsx';
import InstagramSessionView from './components/InstagramSessionView.jsx';
import ReelProcessingView from './components/ReelProcessingView.jsx';
import ReviewCommentsView from './components/ReviewCommentsView.jsx';
import GeminiConfigView from './components/GeminiConfigView.jsx';
import ActivityHistoryView from './components/ActivityHistoryView.jsx';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const DEFAULT_STATUS = {
  status: 'idle',
  currentStep: 'Ready to start',
  currentReelUrl: '',
  targetReels: 50,
  selectedModel: 'gemini-3.8-flash',
  stats: {
    totalProcessed: 0,
    totalVideosAnalyzed: 0,
    totalCommentsGenerated: 0,
    totalCommentsApproved: 0,
    totalCommentsPosted: 0,
    totalQueueLength: 0,
    pendingCount: 0
  },
  instagramSession: {
    isLoggedIn: false,
    homepageUrl: 'https://www.instagram.com/?hl=en',
    reelsUrl: 'https://www.instagram.com/reels'
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [statusData, setStatusData] = useState(DEFAULT_STATUS);
  const [keys, setKeys] = useState([]);
  const [models, setModels] = useState([]);
  const [reels, setReels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedReelId, setSelectedReelId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backendError, setBackendError] = useState(null);

  // Fetch full state from backend
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, keysRes, modelsRes, reelsRes, logsRes] = await Promise.all([
        api.getStatus(),
        api.getKeys(),
        api.getModels(),
        api.getReels(),
        api.getLogs()
      ]);

      setStatusData(statusRes || DEFAULT_STATUS);
      setKeys(keysRes.keys || []);
      setModels(modelsRes.models || []);
      setReels(reelsRes.reels || []);
      setLogs(logsRes.logs || []);
      setBackendError(null);
    } catch (err) {
      console.warn('Backend fetch check:', err.message);
      setBackendError(err.message || 'Cannot connect to ReelAI backend on port 47829');
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling loop for active state updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Engine Actions
  const handleStartEngine = async () => {
    await api.startEngine();
    await fetchData();
  };

  const handlePauseEngine = async () => {
    await api.pauseEngine();
    await fetchData();
  };

  const handleResumeEngine = async () => {
    await api.resumeEngine();
    await fetchData();
  };

  const handleStopEngine = async () => {
    await api.stopEngine();
    await fetchData();
  };

  const handleSetTarget = async (target) => {
    await api.setTarget(target);
    await fetchData();
  };

  const handleSelectModel = async (modelId) => {
    // Optimistically synchronize selectedModel everywhere immediately
    setStatusData((prev) => ({
      ...(prev || DEFAULT_STATUS),
      selectedModel: modelId
    }));
    try {
      const updated = await api.setModel(modelId);
      setStatusData((prev) => ({
        ...(prev || DEFAULT_STATUS),
        ...updated,
        selectedModel: modelId
      }));
    } catch (err) {
      console.error('Failed to persist model selection to backend:', err);
      await fetchData();
    }
  };

  // Key Actions
  const handleAddKey = async (data) => {
    const res = await api.addKey(data);
    await fetchData();
    return res;
  };

  const handleTestKey = async (id, modelId = null) => {
    const targetModel = modelId || statusData?.selectedModel || 'gemini-3.8-flash';
    const res = await api.testKey(id, targetModel);
    await fetchData();
    return res;
  };

  const handleActivateKey = async (id) => {
    const res = await api.activateKey(id);
    await fetchData();
    return res;
  };

  const handleDeleteKey = async (id) => {
    const res = await api.deleteKey(id);
    await fetchData();
    return res;
  };

  // Reel Actions
  const handleAddReel = async (formDataOrJson) => {
    const res = await api.addReel(formDataOrJson);
    await fetchData();
    return res;
  };

  const handleBatchAddReels = async (urls) => {
    const res = await api.batchAddReels(urls);
    await fetchData();
    return res;
  };

  const handleRetryReel = async (id) => {
    const res = await api.retryReel(id);
    await fetchData();
    return res;
  };

  const handleDeleteReel = async (id) => {
    const res = await api.deleteReel(id);
    await fetchData();
    return res;
  };

  // Comment Actions
  const handleToggleApproveComment = async (id) => {
    const res = await api.toggleApproveComment(id);
    await fetchData();
    return res;
  };

  const handleTogglePostComment = async (id) => {
    const res = await api.togglePostComment(id);
    await fetchData();
    return res;
  };

  // Instagram Actions
  const handleOpenInstagram = async (target, url = null) => {
    await api.openInstagram(target, url);
  };

  const handleUpdateSession = async (isLoggedIn) => {
    await api.updateInstagramSession(isLoggedIn);
    await fetchData();
  };

  // Utility Actions
  const handleClearLogs = async () => {
    await api.clearLogs();
    await fetchData();
  };

  const handleSeedSamples = async () => {
    const res = await api.seedSamples();
    await fetchData();
    return res;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b12] text-slate-100">
      {/* Left Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        stats={statusData?.stats}
        keys={keys}
        status={statusData?.status}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentView={currentView}
          statusData={statusData}
          keys={keys}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          onOpenInstagram={handleOpenInstagram}
        />

        {/* Connection Failure Notification Banner */}
        {backendError && (
          <div className="bg-red-500/15 border-b border-red-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{backendError}</span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 font-semibold text-[11px] text-white transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Retry Connection
            </button>
          </div>
        )}

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-8">
          {currentView === 'dashboard' && (
            <DashboardView
              statusData={statusData}
              keys={keys}
              onStart={handleStartEngine}
              onPause={handlePauseEngine}
              onResume={handleResumeEngine}
              onStop={handleStopEngine}
              onSetTarget={handleSetTarget}
              onOpenInstagram={handleOpenInstagram}
              onUpdateSession={handleUpdateSession}
              onSeedSamples={handleSeedSamples}
              setCurrentView={setCurrentView}
            />
          )}

          {currentView === 'instagram' && (
            <InstagramSessionView
              statusData={statusData}
              onOpenInstagram={handleOpenInstagram}
              onUpdateSession={handleUpdateSession}
            />
          )}

          {currentView === 'queue' && (
            <ReelProcessingView
              reels={reels}
              statusData={statusData}
              onStart={handleStartEngine}
              onPause={handlePauseEngine}
              onResume={handleResumeEngine}
              onStop={handleStopEngine}
              onSetTarget={handleSetTarget}
              onAddReel={handleAddReel}
              onBatchAddReels={handleBatchAddReels}
              onRetryReel={handleRetryReel}
              onDeleteReel={handleDeleteReel}
              onSeedSamples={handleSeedSamples}
              onOpenInstagram={handleOpenInstagram}
              setCurrentView={setCurrentView}
              setSelectedReelId={setSelectedReelId}
            />
          )}

          {currentView === 'review' && (
            <ReviewCommentsView
              reels={reels}
              selectedReelId={selectedReelId}
              onToggleApprove={handleToggleApproveComment}
              onTogglePost={handleTogglePostComment}
              onOpenInstagram={handleOpenInstagram}
            />
          )}

          {currentView === 'gemini' && (
            <GeminiConfigView
              keys={keys}
              models={models}
              statusData={statusData}
              onAddKey={handleAddKey}
              onTestKey={handleTestKey}
              onActivateKey={handleActivateKey}
              onDeleteKey={handleDeleteKey}
              onSelectModel={handleSelectModel}
            />
          )}

          {currentView === 'logs' && (
            <ActivityHistoryView
              logs={logs}
              onClearLogs={handleClearLogs}
              stats={statusData?.stats}
            />
          )}
        </main>
      </div>
    </div>
  );
}
