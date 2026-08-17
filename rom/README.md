# 🧠 ROM — Router & Orchestrator Microservice

<p align="center">
  <img src="../client/assets/logo.png" alt="ROM Logo" width="100" />
</p>

<p align="center">
  <strong>A high-performance LLM Router & Orchestrator microservice built to manage multi-provider AI keys, scope-based fallback routing, rate limit metrics, and AES-256-GCM key security without quota exhaustion.</strong>
</p>

<p align="center">
  <a href="https://github.com/asadiabdullah/learntalk"><img src="https://img.shields.io/badge/Microservice-ROM-blueviolet.svg" alt="ROM Microservice"></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/Fastify-TypeScript-000000.svg?logo=fastify" alt="Fastify"></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E.svg?logo=supabase" alt="Supabase"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

---

## 📌 Overview

**ROM (Router & Orchestrator Microservice)** is the AI engine behind the Learntalk platform. It provides a unified, OpenAI-compatible proxy interface that automatically routes LLM prompts to the optimal AI model based on task scope (`persona`, `koreksi`, `ujian`, `leta`, `raport`, `rangkuman`, `embedding`).

If a primary provider or model encounters rate limits (RPM/RPD), ROM seamlessly fails over to fallback models defined in the database priority queue.

---

## ✨ Key Capabilities

- **🔀 Scope-Based Fallback Routing**: Priority-queued routing per task scope. If Priority #1 fails or exceeds rate limits, ROM automatically fails over to Priority #2, #3, etc.
- **🔐 AES-256-GCM API Key Encryption**: All third-party API keys (Groq, Gemini, Cohere, SambaNova) are stored encrypted at rest.
- **📊 Quota & Rate Limit Tracking**: Tracks Requests Per Minute (RPM), Requests Per Day (RPD), Tokens Per Minute (TKM), and Tokens Per Day (TKD).
- **🖥️ Admin SPA Dashboard**: Full-featured admin portal (`/public/dashboard.html`) to manage Providers, API Keys, Models, Scopes, and Scope-Model priority mapping.
- **🔌 OpenAI Compatible Proxy (`/api/route`)**: Returns standard OpenAI `ChatCompletion` payload format (`{"choices":[{"message":{"content":"..."}}]}`).

---

## 🗄️ Database Schema & Architecture

ROM runs on PostgreSQL (Supabase) with the following core schema:

```
                          ┌────────────────────────┐
                          │       providers        │
                          └───────────┬────────────┘
                                      │ 1:N
                          ┌───────────▼────────────┐
                          │        api_keys        │
                          │   (AES-256 Encrypted)  │
                          └───────────┬────────────┘
                                      │ 1:N
                          ┌───────────▼────────────┐
                          │         models         │
                          └───────────┬────────────┘
                                      │ N:M (via scope_models)
                          ┌───────────▼────────────┐
                          │         scopes         │
                          │(persona, koreksi, etc) │
                          └────────────────────────┘
```

---

## 🔌 API Endpoint Contract

### POST `/api/route`
Executes an AI request for a specific scope.

#### Request Body
```json
{
  "scope": "persona",
  "prompt": "<System>...</System>"
}
```

#### Response Body (OpenAI Standard)
```json
{
  "id": "chatcmpl-rom-xxxx",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"response\":\"...\",\"translation\":\"...\",\"tokens\":[]}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 85,
    "total_tokens": 205
  }
}
```

---

## 💻 Tech Stack & Directory Structure

```
rom/
├── api/
│   └── route.js            # Vercel Serverless Function Proxy & Scope Router
├── lib/
│   └── db.js               # Supabase PostgreSQL Pooler Connection
├── public/                 # Admin Dashboard SPA Assets
│   ├── dashboard.html      # ROM Admin Portal UI
│   ├── login.html          # Authentication Page
│   ├── style.css           # Modern Dashboard Styling
│   └── app.js              # SPA Ajax State Controller
├── scripts/                # Database Administration Scripts
├── schema.sql              # Supabase DDL SQL File
├── init-db.js              # Boot Migration Script
└── package.json            # Node.js Dependencies
```

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
cd rom
npm install
```

### 2. Configure Environment Variables
Create a `.env` file:
```env
DATABASE_URL=postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
ENCRYPTION_KEY=32_character_hex_encryption_key_here
ADMIN_USER=asadiabdullah
ADMIN_PASS=your_password
```

### 3. Initialize Database Tables
```bash
node init-db.js
```

### 4. Run Server in Development Mode
```bash
npm run dev
```
Open admin portal at `http://localhost:3000/dashboard/login.html`.

---

## 👤 Author

**Asadi Abdullah** — *Junior App & Website Engineer*  
- GitHub: [@asadiabdullah](https://github.com/asadiabdullah)

---

## 📄 License

This microservice is licensed under the [MIT License](LICENSE).
