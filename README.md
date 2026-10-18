# ReelAI Comment Assistant 🚀

An AI-powered desktop application built with **Electron, React, Vite, Tailwind CSS, Node.js/Express, and SQLite**, integrated with the official **Google Gemini API** (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-1.5-flash`, `gemini-1.5-pro`) to analyze Instagram Reels and generate relevant, natural-sounding, human-quality comments based on actual video content.

---

## 🌟 Key Highlights & Capabilities

### 1. Multimodal Video Analysis
- Analyzes actual video content (`.mp4`, `.mov`, `.webm`) using Google Gemini's multimodal video understanding.
- Detects visible actions, subjects, camera movement, humor, audio cues, mood, and language.
- Classifies Reels into distinct categories: **Travel**, **Technology**, **Food**, **Fitness**, **Comedy**, **Education**, **Fashion**, **Lifestyle**, and more.

### 2. High-Quality Human-Sounding Comments
- Generates **3 distinct, natural comments** matching the tone and vibe of the video.
- **Strict Anti-Spam & Authenticity Rules**:
  - No generic praise (e.g. *“Nice video”* or *“Great post”* are forbidden).
  - No fake personal claims or misleading assumptions about unseen content.
  - No irrelevant hashtags.
  - Max 1 naturally placed emoji or none.
  - Avoids repetition across reels by cross-referencing past generation history.

### 3. Human-In-The-Loop Workflow (Policy Compliant)
- **Zero Instagram Password Collection**: Authenticate directly in your default browser. Passwords are never collected, handled, or saved.
- **One-Click “Copy & Open Reel”**: User reviews and approves comments. The application copies the comment to the system clipboard and launches the Reel in the user's default browser for manual posting. No automatic bot spamming.

### 4. Enterprise-Grade Credential Protection
- Encrypted using the **Operating System Credential Manager** (Windows DPAPI / machine-bound AES-256-GCM vault).
- API keys are **never printed in application logs, exported in screenshots, or exposed in frontend code**.
- Supports multiple authorized API keys with live latency tests.
- **Strict Compliance**: When a key hits quota limits (HTTP 429 or 503), processing pauses immediately and prompts the user to select another valid key manually—no evasion or unauthorized rotation.

### 5. Persistent Local SQLite Database
- Powered by Node.js native `node:sqlite` (`DatabaseSync`), preserving session progress, target goals, categorized reels, comments, and audited event logs across restarts.

---

## 🧭 Exact Instagram Starting Points

| Target | URL | Description |
| :--- | :--- | :--- |
| **Instagram Homepage** | `https://www.instagram.com/?hl=en` | Log into your account or view main feed |
| **Instagram Reels Hub** | `https://www.instagram.com/reels` | Browse trending Reels in default browser |

---

## 🖥️ Application Architecture

```
Instagram_Bot/
├── electron/
│   ├── main.cjs               # Electron main process (window, DPAPI safeStorage, shell)
│   └── preload.cjs            # Secure contextBridge API bridge
├── server/
│   ├── index.js               # Express REST API (status, reels, comments, keys, logs)
│   ├── db.js                  # SQLite persistence via node:sqlite (WAL mode)
│   ├── credentials.js         # OS Credential Manager (DPAPI / AES-256-GCM vault)
│   ├── gemini.js              # Official Google Gemini SDK integration & multimodal prompt
│   ├── engine.js              # Queue processing state machine (Start/Pause/Resume/Stop)
│   └── instagram.js           # Browser launcher for exact Instagram URLs
├── src/
│   ├── App.jsx                # Main unified React dashboard
│   ├── api.js                 # Frontend REST API client
│   ├── index.css              # Glassmorphic Tailwind CSS design system
│   ├── components/
│   │   ├── Sidebar.jsx        # Navigation & live engine status indicator
│   │   ├── Header.jsx         # Status bar, active model, and browser session pill
│   │   ├── DashboardView.jsx  # Stats cards, target progress bar, quick engine controls
│   │   ├── InstagramSessionView.jsx # Exact Instagram starting points & login check
│   │   ├── ReelProcessingView.jsx   # Queue manager, video uploader, batch import
│   │   ├── ReviewCommentsView.jsx   # 3-comment studio, tone badges, approval confetti
│   │   ├── GeminiConfigView.jsx     # Multi-key vault, model selector, quota monitor
│   │   ├── ActivityHistoryView.jsx  # Audited event log with search and JSON export
│   │   └── InstagramIcon.jsx  # Pixel-perfect Instagram SVG component
├── data/
│   └── reelai_assistant.sqlite # Persistent SQLite database
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ (tested on Node v24.16.0)
- **Google Gemini API Key**: Free or paid key from [Google AI Studio](https://aistudio.google.com/)

### 2. Start Application
To run the full development environment (Express Backend on `http://localhost:47829` and Vite React Client on `http://localhost:5173`):
```bash
npm run dev
```

To run as an Electron Desktop application:
```bash
npm run app
```

### 3. Quick Workflow Walkthrough
1. **Open Instagram**: In **Instagram Session**, click *Open Instagram Homepage* to verify you are signed into your Instagram account in your browser.
2. **Add Gemini API Key**: Navigate to **Gemini AI Config**, input your Gemini API Key, and click *Save & Secure Key*.
3. **Queue Reels**:
   - Navigate to **Reels & Videos**.
   - Input a Reel URL, or attach a video file (`.mp4`, `.mov`, `.webm`) for deep visual frame analysis, or click **Load 4 Realistic Demo Reels** for instant testing.
4. **Start Assistant**: Configure your target (e.g. 50 Reels) and click **Start Processing**.
5. **Review Comments**:
   - Head to **Review Comments**.
   - Read the 3 human-like comments and visual summary.
   - Click **Approve** (with celebration animation).
   - Click **Copy & Open** to copy the comment directly to your clipboard and jump straight into the Reel tab in your browser!
   - Check **Posted to Instagram** to mark it complete.
