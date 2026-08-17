# 🌐 Learntalk — AI-Powered Multilingual Language Learning PWA

<p align="center">
  <strong>A modern Progressive Web Application for immersive, AI-driven language practice featuring customizable personas, real-time grammar correction, goal-oriented exam simulations, and RAG memory.</strong>
</p>

<p align="center">
  <a href="https://github.com/asadiabdullah/learntalk"><img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status"></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-8.2-646CFF.svg?logo=vite" alt="Vite"></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E.svg?logo=supabase" alt="Supabase"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps"><img src="https://img.shields.io/badge/PWA-Enabled-5A0FC8.svg?logo=pwa" alt="PWA"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

## 📌 Overview

**Learntalk** is an interactive language learning platform designed to bridge the gap between theoretical grammar study and practical conversation. Built as a high-performance **Progressive Web App (PWA)**, Learntalk connects users with intelligent AI Personas for natural roleplay in **Japanese** and **English**.

Powered by a decoupled **ROM (Model Orchestrator)** backend architecture, Learntalk seamlessly manages multi-LLM routing, real-time grammar feedback, dynamic scoring, and adaptive memory diagnostics.

---

## ✨ Key Features

### 🎭 1. Customizable AI Personas
- **Targeted Practice**: Practice with AI tutors configured with specific ages, professions, personalities, speech levels (e.g., JLPT N5–N1), and conversational goals.
- **Natural Roleplay**: AI responds strictly in character while adjusting its comprehension and vocabulary to your skill level.

### ✍️ 2. Mode Koreksi (Real-time Grammar Check)
- **Visual Diff Highlighting**: Instantly highlights grammar and spelling mistakes with inline diffs (`~~incorrect~~ correct`).
- **Indonesian Explanations**: Provides 1-sentence explanations of why a correction was made without breaking the conversation flow.

### 📝 3. Simulasi Ujian (Exam Mode)
- **Goal-Oriented Scenarios**: Practice under specific constraints (e.g., negotiating price, asking for directions at Haneda Airport).
- **Real-Time AI Scoring (`point`)**: Dynamic evaluation score (1–10+) updated live in the chat header as the conversation progresses.
- **Turn Tracking (`turn`)**: Tracks conversation progress towards scenario completion.

### 🤖 4. Tanya Leta (Context-Aware AI Assistant)
- **Dynamic Context**: Ask questions about a specific chat bubble (`Bertanya: "..."`) or general conversation with the active persona.
- **Rich Markdown Output**: Delivers formatted grammar rules, bullet points, and example sentences in Indonesian and target languages.
- **Clean UI**: Modal automatically resets on exit, keeping a clean state for every new inquiry.

### 🃏 5. Pecah Kata & Interactive Word Cards
- **Sentence Tokenization**: Break down Japanese/English sentences into individual clickable word tokens.
- **Word Card Popover**: Displays word readings (Furigana/Romaji), exact meanings, and star bookmarking for vocabulary building.

### 📊 6. Laporan Raport Kelemahan (AI Diagnostic Reports)
- **Session Evaluation**: Analyzes the last 10–20 turns to generate a comprehensive diagnostic report.
- **Automatic Profile Sync**: Stores identified language weaknesses in `user_profiles` to tailor future AI responses.

### 💬 7. WhatsApp-Style UX & Status Indicators
- **System Notification Pills**: Clean, centered status indicators (`Sedang mengoreksi...`, `Menghubungi Rina...`, `Memuat obrolan...`).
- **Typing Indicator Animation**: Animated 3-dot typing bubble (`...`) rendered live while AI models generate responses.

---

## 🛠️ Architecture & Tech Stack

Learntalk adopts a modular architecture separating the frontend client application from the model orchestrator proxy.

```
                  ┌─────────────────────────────────────────┐
                  │            Learntalk PWA                │
                  │   (Vite + Vanilla ES Modules + CSS3)    │
                  └────────────────────┬────────────────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        ┌─────────────────────────┐         ┌─────────────────────────┐
        │  Supabase BaaS Engine   │         │   ROM Model Orchestrator │
        │ (PostgreSQL, Auth, RLS) │         │ (OpenAI-standard Router)│
        └─────────────────────────┘         └────────────┬────────────┘
                                                         │
                                        ┌────────────────┴────────────────┐
                                        ▼                                 ▼
                           ┌─────────────────────────┐       ┌─────────────────────────┐
                           │   Groq (Qwen / Llama)   │       │   Gemini 3.7 / Gemma    │
                           └─────────────────────────┘       └─────────────────────────┘
```

- **Frontend Core**: Vanilla JavaScript (ES Modules), HTML5, Modern CSS3 with CSS Variables.
- **Build System & PWA**: [Vite 8](https://vitejs.dev/) with `vite-plugin-pwa` and Workbox for offline caching.
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security policies for `user_profiles`, `personas`, `messages`, `exam_messages`, and `cards`).
- **AI Routing Proxy**: **ROM (Model Orchestrator)** hosted on Vercel, providing scope-based fallback routing across Groq (Qwen 27B, Llama 70B/120B), Google Gemini (Gemma 31B, Gemini 3.7 Flash), and Cohere models.

---

## 📂 Project Structure

```
learntalk/
├── client/                     # Learntalk PWA Frontend Client
│   ├── index.html              # Single Page Application Entry & Modals
│   ├── style.css               # Modern Responsive Styling & Animations
│   ├── vercel.json             # Vercel Deployment & API Rewrites Configuration
│   ├── package.json            # Client Dependencies & Scripts
│   ├── scripts/                # Database Migration SQL Scripts
│   │   ├── setup_tables_v3.sql
│   │   └── run_client_migration.js
│   └── src/
│       └── main.js             # Client Logic, State Management & ROM API Client
├── rom/                        # ROM Model Orchestrator Backend Subsystem
│   ├── api/
│   │   └── route.js            # Unified LLM Scope Routing & Fallback API
│   └── lib/
│       └── db.js               # ROM PostgreSQL Connection Pool
└── README.md                   # Project Documentation
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A [Supabase](https://supabase.com/) account & project setup
- A deployed **ROM Orchestrator** instance (or environment API key)

### 1. Clone the Repository
```bash
git clone https://github.com/asadiabdullah/learntalk.git
cd learntalk/client
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file inside the `client/` directory:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 👤 Author & Developer Profile

<table align="center">
  <tr>
    <td align="center">
      <strong>Asadi Abdullah</strong><br />
      <em>Junior App & Website Engineer</em>
      <br /><br />
      <a href="https://github.com/asadiabdullah">
        <img src="https://img.shields.io/badge/GitHub-asadiabdullah-181717?style=flat&logo=github" alt="GitHub" />
      </a>
    </td>
  </tr>
</table>

Passionate about crafting intuitive, high-performance web applications and embedding modern AI technologies into human-centric user experiences. Specialized in modern JavaScript, responsive UI design, BaaS integration, and LLM API orchestrations.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
