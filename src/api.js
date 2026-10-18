const BACKEND_PORT = 47829;
const DIRECT_API_URL = `http://localhost:${BACKEND_PORT}/api`;

/**
 * Resilient request helper with automatic proxy failover and clear network error diagnostics
 */
async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  async function parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      const errMsg = data?.error || data?.message || `Server responded with status ${res.status} (${res.statusText})`;
      throw new Error(errMsg);
    }

    return data;
  }

  // 1. Try relative path '/api/...' via Vite dev proxy
  const proxyUrl = `/api${cleanEndpoint}`;
  try {
    const res = await fetch(proxyUrl, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    // If Vite proxy returns an HTML gateway error (504/502/404), fall through to direct call
    if (!res.ok && contentType.includes('text/html')) {
      throw new Error(`Proxy returned HTML error (${res.status})`);
    }
    return await parseResponse(res);
  } catch (proxyError) {
    // 2. Fallback: try connecting directly to Express backend on port 47829
    const directUrl = `${DIRECT_API_URL}${cleanEndpoint}`;
    try {
      const directRes = await fetch(directUrl, { ...options, headers });
      return await parseResponse(directRes);
    } catch (directError) {
      // Both proxy and direct connection failed
      throw new Error(
        `Cannot connect to ReelAI backend server at http://localhost:${BACKEND_PORT}. Please ensure the Express backend is running (run 'npm run dev' or 'npm run dev:server').`
      );
    }
  }
}

export const api = {
  getStatus() {
    return request('/status');
  },

  startEngine() {
    return request('/engine/start', { method: 'POST' });
  },

  pauseEngine() {
    return request('/engine/pause', { method: 'POST' });
  },

  resumeEngine() {
    return request('/engine/resume', { method: 'POST' });
  },

  stopEngine() {
    return request('/engine/stop', { method: 'POST' });
  },

  setTarget(target) {
    return request('/engine/target', {
      method: 'POST',
      body: JSON.stringify({ target })
    });
  },

  setModel(modelId) {
    return request('/engine/model', {
      method: 'POST',
      body: JSON.stringify({ modelId })
    });
  },

  getModels() {
    return request('/models');
  },

  getKeys() {
    return request('/keys');
  },

  addKey({ nickname, apiKey, testNow = true, modelId = null }) {
    return request('/keys', {
      method: 'POST',
      body: JSON.stringify({ nickname, apiKey, testNow, modelId })
    });
  },

  testKey(id, modelId = null) {
    return request(`/keys/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ modelId })
    });
  },

  activateKey(id) {
    return request(`/keys/${id}/activate`, { method: 'POST' });
  },

  deleteKey(id) {
    return request(`/keys/${id}`, { method: 'DELETE' });
  },

  getReels() {
    return request('/reels');
  },

  addReel(formDataOrJson) {
    const isFormData = typeof FormData !== 'undefined' && formDataOrJson instanceof FormData;
    return request('/reels', {
      method: 'POST',
      body: isFormData ? formDataOrJson : JSON.stringify(formDataOrJson)
    });
  },

  batchAddReels(urls) {
    return request('/reels/batch', {
      method: 'POST',
      body: JSON.stringify({ urls })
    });
  },

  retryReel(id) {
    return request(`/reels/${id}/retry`, { method: 'POST' });
  },

  uploadReelVideo(id, file) {
    const formData = new FormData();
    formData.append('video', file);
    return request(`/reels/${id}/video`, {
      method: 'POST',
      body: formData
    });
  },

  deleteReel(id) {
    return request(`/reels/${id}`, { method: 'DELETE' });
  },

  toggleApproveComment(id) {
    return request(`/comments/${id}/approve`, { method: 'POST' });
  },

  togglePostComment(id) {
    return request(`/comments/${id}/post`, { method: 'POST' });
  },

  openInstagram(target, url = null) {
    return request('/instagram/open', {
      method: 'POST',
      body: JSON.stringify({ target, url })
    });
  },

  updateInstagramSession(isLoggedIn) {
    return request('/instagram/session', {
      method: 'POST',
      body: JSON.stringify({ isLoggedIn })
    });
  },

  getLogs() {
    return request('/logs');
  },

  clearLogs() {
    return request('/logs', { method: 'DELETE' });
  },

  seedSamples() {
    return request('/seed-samples', { method: 'POST' });
  }
};

export default api;
