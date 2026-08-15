-- 1. Buat Tabel Personas
CREATE TABLE IF NOT EXISTS public.personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    language TEXT NOT NULL,
    lang_level TEXT NOT NULL,
    indo_level TEXT NOT NULL,
    goal TEXT,
    gender TEXT NOT NULL,
    age INTEGER NOT NULL,
    job TEXT,
    description TEXT,
    personality TEXT,
    speech_style TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan RLS (Row Level Security) untuk tabel personas
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- Policy: User hanya bisa melihat persona miliknya sendiri
CREATE POLICY "User can view their own personas" 
ON public.personas FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: User hanya bisa membuat persona miliknya sendiri
CREATE POLICY "User can insert their own personas" 
ON public.personas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: User hanya bisa mengupdate persona miliknya sendiri
CREATE POLICY "User can update their own personas" 
ON public.personas FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: User hanya bisa menghapus persona miliknya sendiri
CREATE POLICY "User can delete their own personas" 
ON public.personas FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Setup Storage: Buat Bucket 'avatars' (Jika belum ada)
-- Note: Insert ke storage.buckets mengabaikan RLS karena dilakukan oleh admin
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 10485760, ARRAY['image/png', 'image/jpg', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Setup Storage Policies untuk bucket 'avatars'

-- Policy: Siapapun bisa melihat gambar avatar (Public)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Hanya user yang login yang bisa mengunggah avatar
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Policy: User hanya bisa memperbarui avatar miliknya sendiri
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: User hanya bisa menghapus avatar miliknya sendiri
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
);
