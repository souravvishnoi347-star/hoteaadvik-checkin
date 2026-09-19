-- Run this in Supabase SQL Editor if you want dedicated advance_amount & balance_amount columns
ALTER TABLE public."Bookings" ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0;
ALTER TABLE public."Bookings" ADD COLUMN IF NOT EXISTS balance_amount NUMERIC DEFAULT 0;
