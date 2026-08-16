-- Skema Database ROM (Router & Orchestrator Microservice)

-- Hapus tabel jika ada (urutan dari yang memiliki foreign key terbanyak)
DROP TABLE IF EXISTS scope_models CASCADE;
DROP TABLE IF EXISTS scopes CASCADE;
DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- Enable UUID extension jika belum aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabel api_keys (Menyimpan kredensial penyedia)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL, -- gemini, groq, openaifree, dll.
    secret_key TEXT NOT NULL,       -- Kunci API terenkripsi (AES-256-GCM)
    sharing_limits TEXT[] DEFAULT '{}', -- Array berisi limit yang dibagi, misal: {'rpd', 'tkd'}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel models (Menyimpan model spesifik & metrik penggunaan kuota)
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    model_identifier VARCHAR(255) NOT NULL, -- Nama model, misal: gemini-1.5-flash
    
    -- Limit Statis (Konfigurasi Quota)
    rpm INTEGER DEFAULT 0,  -- Requests Per Minute
    rph INTEGER DEFAULT 0,  -- Requests Per Hour
    rpd INTEGER DEFAULT 0,  -- Requests Per Day
    rpmo INTEGER DEFAULT 0, -- Requests Per Month
    tkm INTEGER DEFAULT 0,  -- Tokens Per Minute
    tkh INTEGER DEFAULT 0,  -- Tokens Per Hour
    tkd INTEGER DEFAULT 0,  -- Tokens Per Day
    tkmo INTEGER DEFAULT 0, -- Tokens Per Month
    
    -- Limit Dinamis (Counter Penggunaan)
    rpm_used INTEGER DEFAULT 0,
    rph_used INTEGER DEFAULT 0,
    rpd_used INTEGER DEFAULT 0,
    rpmo_used INTEGER DEFAULT 0,
    tkm_used INTEGER DEFAULT 0,
    tkh_used INTEGER DEFAULT 0,
    tkd_used INTEGER DEFAULT 0,
    tkmo_used INTEGER DEFAULT 0,
    
    -- Timestamp untuk Reset Dinamis (Lazy Reset)
    last_reset_minute TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_reset_hour TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_reset_day TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_reset_month TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Manajemen Karantina & Status
    quarantine_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    error_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- active, quarantined, inactive
    model_type VARCHAR(100) NOT NULL CHECK (model_type IN ('embedding', 'text_out', 'text_to_speech', 'audio_native_dialog', 'translator')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel scopes (Tugas/Scope pemanggilan)
CREATE TABLE scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_name VARCHAR(255) UNIQUE NOT NULL, -- Nama scope unik, misal: embedding_model
    estimated_output_tokens INTEGER DEFAULT 400, -- Default buffer token keluaran
    fallback_scope_id UUID REFERENCES scopes(id) ON DELETE SET NULL, -- Scope cadangan jika semua model gagal
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel scope_models (Relasi scope ke model dengan urutan prioritas)
CREATE TABLE scope_models (
    scope_id UUID NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL, -- Urutan prioritas pemanggilan (1, 2, 3...)
    PRIMARY KEY (scope_id, model_id)
);

-- Indeks untuk meningkatkan performa kueri router
CREATE INDEX idx_models_api_key ON models(api_key_id);
CREATE INDEX idx_scope_models_scope ON scope_models(scope_id);
CREATE INDEX idx_scope_models_priority ON scope_models(priority);

-- 5. Tabel logs (Menyimpan riwayat panggilan & pengujian model)
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES models(id) ON DELETE SET NULL,
    model_identifier VARCHAR(255) NOT NULL,
    scope_name VARCHAR(255) NOT NULL, -- Nama scope, atau 'testing' untuk pengujian model
    status VARCHAR(50) NOT NULL,      -- success, failed
    prompt_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    response_text TEXT,
    error_message TEXT,
    error_count_incremented BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_model_id ON logs(model_id);

