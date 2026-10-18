import React, { useState } from 'react';
import { 
  KeyRound, 
  Plus, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  Lock, 
  Check, 
  HelpCircle,
  Eye,
  EyeOff,
  Radio
} from 'lucide-react';

export default function GeminiConfigView({
  keys,
  models,
  statusData,
  onAddKey,
  onTestKey,
  onActivateKey,
  onDeleteKey,
  onSelectModel
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [testNow, setTestNow] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const selectedModel = statusData?.selectedModel || 'gemini-3.8-flash';
  const activeKey = keys.find((k) => k.is_active);
  const quotaAlert = keys.some((k) => k.status === 'quota_exhausted');

  const handleAddKey = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!apiKeyInput.trim()) {
      setFormError('Please enter a Google Gemini API key.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onAddKey({
        nickname: nicknameInput.trim() || 'Gemini Key',
        apiKey: apiKeyInput.trim(),
        testNow,
        modelId: selectedModel
      });
      setFormSuccess(`API key "${res.key.nickname}" successfully saved and verified with ${selectedModel}!`);
      setApiKeyInput('');
      setNicknameInput('');
    } catch (err) {
      setFormError(err.message || 'Failed to add API key.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestKey = async (id) => {
    try {
      setTestingId(id);
      setFormError('');
      setFormSuccess('');
      const res = await onTestKey(id, selectedModel);
      if (res.success) {
        setFormSuccess(`Key verified successfully with ${res.model || selectedModel}! Latency: ${res.latencyMs}ms`);
      } else {
        setFormError(`Key test failed: ${res.error}`);
      }
    } catch (err) {
      setFormError(err.message || 'Error testing key');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Quota Exhaustion / Compliance Notice */}
      {quotaAlert && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-amber-300">Quota Limit Reached on One or More Keys</h4>
            <p className="text-amber-200/80 leading-relaxed">
              In accordance with Google API policies, ReelAI does not automatically rotate keys to evade usage quotas. Please manually activate an alternate authorized key below, or wait until your quota refreshes.
            </p>
          </div>
        </div>
      )}

      {/* Security Architecture Card */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/40 to-purple-950/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Operating System Credential Manager Protection
              </h3>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Keys are encrypted using Windows DPAPI / machine-bound hardware keys and stored in local SQLite. Plaintext secrets are never returned to the frontend or printed in application logs.
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300 shrink-0">
            Vault Status: Encrypted & Active
          </div>
        </div>
      </div>

      {/* Model Selection Card */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-white text-base">Gemini AI Model Selection</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Select which Google Gemini vision model to use for video frame inspection and comment generation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-purple-300 font-mono font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-white font-sans">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add New Key Form */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div>
          <h4 className="font-bold text-white text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-400" />
            Add Authorized Gemini API Key
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Add multiple keys you are authorized to use. You can switch between them manually at any time.
          </p>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleAddKey} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Key Nickname
              </label>
              <input
                type="text"
                placeholder="e.g., Studio Primary Key"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={testNow}
                onChange={(e) => setTestNow(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
              />
              <span>Verify key latency & validity with Google Gemini API immediately</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-500/25 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Encrypting & Verifying...' : 'Save & Secure Key'}
            </button>
          </div>
        </form>
      </div>

      {/* Configured Keys Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-white text-base">Configured Gemini API Keys</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {keys.length} keys configured in secure OS vault
            </p>
          </div>
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
            <Lock className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-white">No API Keys Configured</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your Google Gemini API key above to start analyzing Instagram Reels with multimodal AI.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const isActive = Boolean(key.is_active);
              const isQuotaExhausted = key.status === 'quota_exhausted';
              const isValid = key.status === 'valid';
              const isInvalid = key.status === 'invalid';

              return (
                <div
                  key={key.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive
                      ? 'bg-purple-950/20 border-purple-500/40 shadow-sm'
                      : isQuotaExhausted
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white text-sm">{key.nickname}</span>
                      
                      {isActive && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Active Key
                        </span>
                      )}

                      <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md ${
                        isValid
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isQuotaExhausted
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : isInvalid
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {isQuotaExhausted ? 'Quota Exhausted' : key.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 font-mono flex items-center gap-3">
                      <span>Key: {key.masked_key}</span>
                      {key.last_tested_at && (
                        <span className="text-[11px] text-slate-500">
                          Tested: {new Date(key.last_tested_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {key.error_message && (
                      <p className="text-xs text-amber-300 bg-amber-950/30 p-2 rounded-xl border border-amber-800/40">
                        {key.error_message}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => onActivateKey(key.id)}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        Set Active
                      </button>
                    )}

                    <button
                      onClick={() => handleTestKey(key.id)}
                      disabled={testingId === key.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingId === key.id ? 'animate-spin' : ''}`} />
                      {testingId === key.id ? 'Testing...' : 'Test Key'}
                    </button>

                    <button
                      onClick={() => onDeleteKey(key.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 transition-all"
                      title="Remove Key"
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
