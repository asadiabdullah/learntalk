CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    language VARCHAR(50) NOT NULL,
    condition TEXT,
    persona TEXT,
    goal TEXT,
    lang_level TEXT,
    indo_level TEXT,
    speech_style TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Policy for exams
DROP POLICY IF EXISTS "Allow user all operations on exams" ON exams;
CREATE POLICY "Allow user all operations on exams" ON exams
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
