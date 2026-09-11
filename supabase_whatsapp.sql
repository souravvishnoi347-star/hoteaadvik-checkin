-- Supabase SQL Schema for Hotel Aadvik Inn WhatsApp AI & Inbox Module

-- 1. Create WhatsAppConversations table
CREATE TABLE IF NOT EXISTS public."WhatsAppConversations" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_phone TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    booking_id INTEGER,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    unread_count INTEGER DEFAULT 0,
    ai_enabled BOOLEAN DEFAULT true
);

-- 2. Create WhatsAppMessages table
CREATE TABLE IF NOT EXISTS public."WhatsAppMessages" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    conversation_id INTEGER NOT NULL REFERENCES public."WhatsAppConversations"(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'staff')),
    message_text TEXT NOT NULL,
    status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'))
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public."WhatsAppConversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WhatsAppMessages" ENABLE ROW LEVEL SECURITY;

-- 4. Policies for WhatsAppConversations
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public."WhatsAppConversations";
CREATE POLICY "Enable all for authenticated users only" ON public."WhatsAppConversations"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Allow anon/webhook operations
DROP POLICY IF EXISTS "Allow anon insert/update for webhook" ON public."WhatsAppConversations";
CREATE POLICY "Allow anon insert/update for webhook" ON public."WhatsAppConversations"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Policies for WhatsAppMessages
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public."WhatsAppMessages";
CREATE POLICY "Enable all for authenticated users only" ON public."WhatsAppMessages"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow anon insert for webhook" ON public."WhatsAppMessages";
CREATE POLICY "Allow anon insert for webhook" ON public."WhatsAppMessages"
    FOR ALL
    USING (true)
    WITH CHECK (true);
