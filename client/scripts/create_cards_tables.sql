-- Create card_groups and cards tables for learntalk client
CREATE TABLE IF NOT EXISTS card_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    group_id UUID REFERENCES card_groups(id) ON DELETE SET NULL,
    word TEXT NOT NULL,
    reading TEXT,
    meaning TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE card_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policies for card_groups
CREATE POLICY "Allow user all operations on card_groups" 
ON card_groups FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Policies for cards
CREATE POLICY "Allow user all operations on cards" 
ON cards FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);
