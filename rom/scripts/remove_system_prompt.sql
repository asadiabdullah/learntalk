-- Hapus kolom system_prompt dari tabel scopes
ALTER TABLE public.scopes DROP COLUMN IF EXISTS system_prompt;
