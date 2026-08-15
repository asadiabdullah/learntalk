-- 1. Buat Tabel user_profiles (Profil Biodata User)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    age INTEGER,
    native_language TEXT DEFAULT 'Indonesia',
    language_weakness TEXT DEFAULT 'Belum terdeteksi kelemahan spesifik.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aktifkan RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies untuk user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);


-- 2. Buat Tabel messages (Riwayat Percakapan)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE NOT NULL,
    sender TEXT CHECK (sender IN ('user', 'ai')) NOT NULL,
    text TEXT NOT NULL,
    corrected_text TEXT,
    diff_html TEXT,
    translation TEXT,
    tokens JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aktifkan RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies untuk messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);


-- 3. Buat Tabel message_embeddings (RAG Memori Vektor)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.message_embeddings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE NOT NULL,
    embedding VECTOR(1536),
    content_summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Aktifkan RLS
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies untuk message_embeddings
DROP POLICY IF EXISTS "Users can view their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can view their own embeddings" ON public.message_embeddings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can insert their own embeddings" ON public.message_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can delete their own embeddings" ON public.message_embeddings FOR DELETE USING (auth.uid() = user_id);


-- 4. Buat Tabel glossary (Kata Favorit)
CREATE TABLE IF NOT EXISTS public.glossary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    word TEXT NOT NULL,
    reading TEXT,
    language TEXT NOT NULL, -- 'jp', 'en'
    furigana TEXT,
    meaning TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, word)
);

-- Aktifkan RLS
ALTER TABLE public.glossary ENABLE ROW LEVEL SECURITY;

-- Policies untuk glossary
DROP POLICY IF EXISTS "Users can view their own glossary" ON public.glossary;
CREATE POLICY "Users can view their own glossary" ON public.glossary FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own glossary" ON public.glossary;
CREATE POLICY "Users can insert their own glossary" ON public.glossary FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own glossary" ON public.glossary;
CREATE POLICY "Users can delete their own glossary" ON public.glossary FOR DELETE USING (auth.uid() = user_id);
