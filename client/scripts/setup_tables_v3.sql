-- 1. Alter personas table to add missing fields for System Prompt Scope A
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS job VARCHAR(255);
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Create user_profiles if not exists
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    age INTEGER,
    native_language TEXT DEFAULT 'Indonesia',
    language_weakness TEXT DEFAULT 'Belum terdeteksi kelemahan spesifik.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Create messages table for normal chat
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
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- 4. Create message_embeddings table for RAG
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.message_embeddings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    persona_id UUID REFERENCES public.personas(id) ON DELETE CASCADE NOT NULL,
    embedding VECTOR(1536),
    content_summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can view their own embeddings" ON public.message_embeddings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can insert their own embeddings" ON public.message_embeddings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON public.message_embeddings;
CREATE POLICY "Users can delete their own embeddings" ON public.message_embeddings FOR DELETE USING (auth.uid() = user_id);

-- 5. Create exam_messages table for exam chat history
CREATE TABLE IF NOT EXISTS public.exam_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
    sender TEXT CHECK (sender IN ('user', 'ai')) NOT NULL,
    text TEXT NOT NULL,
    turn INTEGER,
    point NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.exam_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own exam messages" ON public.exam_messages;
CREATE POLICY "Users can view their own exam messages" ON public.exam_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own exam messages" ON public.exam_messages;
CREATE POLICY "Users can insert their own exam messages" ON public.exam_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own exam messages" ON public.exam_messages;
CREATE POLICY "Users can delete their own exam messages" ON public.exam_messages FOR DELETE USING (auth.uid() = user_id);

-- 6. Alter cards table to support glossary details
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS furigana VARCHAR(255);
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS example_sentence TEXT;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'jp';
