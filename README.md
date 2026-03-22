🛡️ CyberShield AI

Next-generation AI-powered cybersecurity platform for real-time threat detection, vulnerability prioritization, and intelligent security operations.

Built for the digital battlefield — powered by Groq LLaMA 3.3 70B, VirusTotal, and NIST NVD.

✨ Features
ModuleDescription🦠 Malware DetectorReal-time file scanning via VirusTotal API with SHA-256 caching🎭 Phishing & Deepfake InterceptorDetects phishing emails, AI-generated images, and deepfake videos🎯 CVE Triage EngineFetches live NIST NVD data and AI-prioritizes vulnerabilities📄 Policy ChatbotUpload any security PDF and query it in natural language🍯 Honeypot MonitorSimulated live deception network traffic feed🤖 NEXUS AI CopilotStreaming security chatbot for incident response and hardening📊 DashboardReal-time threat metrics, activity feed, and live chart

🧰 Tech Stack
Frontend

React 19 + Vite 8
Tailwind CSS + Framer Motion
Recharts, Lucide React, Socket.IO Client

Backend

Node.js + Express 5
PostgreSQL (Neon DB)
Socket.IO (real-time events)

AI / APIs

Groq — LLaMA 3.3 70B (chat, CVE analysis, phishing detection)
VirusTotal — malware scanning
NIST NVD — live CVE database


🚀 Getting Started
Prerequisites

Node.js >= 20
PostgreSQL database (or Neon DB connection string)

1. Clone the repo
bashgit clone https://github.com/yourusername/cybershieldai.git
cd cybershieldai
2. Set up environment variables
Create a .env file in the root:
envVITE_GROQ_API_KEY=your_groq_api_key
VT_API_KEY=your_virustotal_api_key
DATABASE_URL=your_postgresql_connection_string
GROQ_API_KEY=your_groq_api_key
3. Install dependencies
bash# Frontend
npm install

# Backend
cd backend && npm install
4. Initialize the database
bashnode backend/db.js
5. Run the app
bashnpm run dev
```

This starts both the Vite frontend and Express backend concurrently.

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## 📁 Project Structure
```
cybershieldai/
├── src/
│   ├── pages/          # All page components
│   ├── components/     # Layout, Sidebar
│   └── index.css       # Global styles
├── backend/
│   ├── routes/
│   │   ├── api.js      # Scan, phishing, stats endpoints
│   │   ├── cve.js      # CVE analysis endpoint
│   │   └── policy.js   # PDF upload & Q&A endpoint
│   ├── db.js           # PostgreSQL connection & schema
│   └── server.js       # Express + Socket.IO server
└── .env                # Environment variables (not committed)
