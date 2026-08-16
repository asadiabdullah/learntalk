-- Tambahkan kolom model_type dengan nilai default 'text_out' terlebih dahulu agar baris existing terisi
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS model_type VARCHAR(100) DEFAULT 'text_out';

-- Pasang constraint CHECK agar nilainya hanya di antara 5 jenis model resmi
ALTER TABLE public.models DROP CONSTRAINT IF EXISTS check_model_type;
ALTER TABLE public.models ADD CONSTRAINT check_model_type 
    CHECK (model_type IN ('embedding', 'text_out', 'text_to_speech', 'audio_native_dialog', 'translator'));

-- Set kolom menjadi NOT NULL setelah data existing terisi default
ALTER TABLE public.models ALTER COLUMN model_type SET NOT NULL;
