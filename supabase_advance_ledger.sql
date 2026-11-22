-- ==============================================================================
-- HOTEL AADVIK INN - STAFF SALARY ADVANCE & DEDUCTION LEDGER SETUP
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/ngdauzleenttiwpiokug/sql
-- ==============================================================================

-- 1. Add advance tracking columns to Employees table
ALTER TABLE public."Employees" ADD COLUMN IF NOT EXISTS advance_balance NUMERIC DEFAULT 0;
ALTER TABLE public."Employees" ADD COLUMN IF NOT EXISTS default_monthly_deduction NUMERIC DEFAULT 0;

-- 2. Create EmployeeAdvances Table (Audit trail of every advance given)
CREATE TABLE IF NOT EXISTS public."EmployeeAdvances" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    employee_id INTEGER REFERENCES public."Employees"(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    paid_by TEXT NOT NULL DEFAULT 'Hotel Cash Drawer',
    payment_mode TEXT NOT NULL DEFAULT 'Cash',
    monthly_deduction_plan NUMERIC DEFAULT 0,
    notes TEXT
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public."EmployeeAdvances" ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy
DROP POLICY IF EXISTS "Enable all for EmployeeAdvances" ON public."EmployeeAdvances";
CREATE POLICY "Enable all for EmployeeAdvances" ON public."EmployeeAdvances"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Grant Permissions
GRANT ALL ON public."EmployeeAdvances" TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public."EmployeeAdvances_id_seq" TO anon, authenticated, service_role;
