-- 1. Remove the old permissive SELECT policies
DROP POLICY IF EXISTS "Enable select for anonymous users" ON public."Bookings";
DROP POLICY IF EXISTS "Enable select for anonymous users" ON public."Guests";

-- 2. Create new restricted SELECT policies for authenticated admins only
CREATE POLICY "Enable select for authenticated users only" 
ON public."Bookings" 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable select for authenticated users only" 
ON public."Guests" 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. (Optional but recommended) Restrict UPDATE and DELETE to authenticated admins only
DROP POLICY IF EXISTS "Enable update for anonymous users" ON public."Bookings";
DROP POLICY IF EXISTS "Enable update for anonymous users" ON public."Guests";

CREATE POLICY "Enable update for authenticated users only" 
ON public."Bookings" 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" 
ON public."Guests" 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" 
ON public."Bookings" 
FOR DELETE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" 
ON public."Guests" 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Note: The INSERT policies remain the same so your walk-in guests can still submit the form!
