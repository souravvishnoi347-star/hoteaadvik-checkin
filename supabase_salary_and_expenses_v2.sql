-- ==============================================================================
-- HOTEL AADVIK INN - SALARY & EXPENSES V2 (PARTNER TRANSPARENCY MIGRATION)
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Create Employees table
CREATE TABLE IF NOT EXISTS public."Employees" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    phone TEXT,
    monthly_salary NUMERIC NOT NULL DEFAULT 0,
    joining_date DATE,
    id_proof_number TEXT,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive'))
);

-- 2. Create Salaries table
CREATE TABLE IF NOT EXISTS public."Salaries" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id INTEGER REFERENCES public."Employees"(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    month_year TEXT NOT NULL,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    advance_deduction NUMERIC DEFAULT 0,
    bonus_overtime NUMERIC DEFAULT 0,
    net_paid NUMERIC NOT NULL DEFAULT 0,
    payment_date DATE NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'Cash',
    paid_by TEXT NOT NULL DEFAULT 'Hotel Cash',
    payment_status TEXT DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Partial', 'Advance')),
    notes TEXT
);

-- 3. Enhance Expenses table for Partner Transparency
ALTER TABLE public."Expenses" ADD COLUMN IF NOT EXISTS paid_to TEXT;
ALTER TABLE public."Expenses" ADD COLUMN IF NOT EXISTS paid_by TEXT DEFAULT 'Hotel Cash';
ALTER TABLE public."Expenses" ADD COLUMN IF NOT EXISTS bill_number TEXT;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public."Employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Salaries" ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Employees (Authenticated Admins)
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public."Employees";
CREATE POLICY "Enable all for authenticated users only" ON public."Employees"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. Policies for Salaries (Authenticated Admins)
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public."Salaries";
CREATE POLICY "Enable all for authenticated users only" ON public."Salaries"
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 7. Grant Permissions to authenticated and service_role
GRANT ALL ON public."Employees" TO authenticated, service_role;
GRANT ALL ON public."Salaries" TO authenticated, service_role;
GRANT ALL ON SEQUENCE public."Employees_id_seq" TO authenticated, service_role;
GRANT ALL ON SEQUENCE public."Salaries_id_seq" TO authenticated, service_role;
