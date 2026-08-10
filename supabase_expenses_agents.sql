-- 1. Add payment_mode to Bookings
ALTER TABLE public."Bookings" ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';

-- 2. Create Expenses table
CREATE TABLE IF NOT EXISTS public."Expenses" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE NOT NULL,
    expense_name TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    mode TEXT NOT NULL,
    notes TEXT
);

-- 3. Create Agents table
CREATE TABLE IF NOT EXISTS public."Agents" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    total_guests INTEGER DEFAULT 0,
    total_credit NUMERIC DEFAULT 0,
    total_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Active'
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public."Expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Agents" ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Expenses (Authenticated Admin Only)
CREATE POLICY "Enable all for authenticated users only" ON public."Expenses"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. Policies for Agents (Authenticated Admin Only)
CREATE POLICY "Enable all for authenticated users only" ON public."Agents"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
