-- Create Bookings table
CREATE TABLE public."Bookings" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    check_in_date TEXT NOT NULL,
    check_out_date TEXT NOT NULL,
    agreed_price NUMERIC,
    status TEXT DEFAULT 'checked_in'
);

-- Create Guests table
CREATE TABLE public."Guests" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    booking_id INTEGER REFERENCES public."Bookings"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    phone TEXT,
    id_image_url TEXT,
    id_image_back_url TEXT
);

-- Set up Row Level Security (RLS)
ALTER TABLE public."Bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Guests" ENABLE ROW LEVEL SECURITY;

-- Create policies to allow anonymous users to insert and select data
CREATE POLICY "Enable insert for anonymous users" ON public."Bookings" FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for anonymous users" ON public."Bookings" FOR SELECT USING (true);
CREATE POLICY "Enable update for anonymous users" ON public."Bookings" FOR UPDATE USING (true);

CREATE POLICY "Enable insert for anonymous users" ON public."Guests" FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for anonymous users" ON public."Guests" FOR SELECT USING (true);
CREATE POLICY "Enable update for anonymous users" ON public."Guests" FOR UPDATE USING (true);

-- Storage bucket setup for id_proofs
-- Note: You also need to create a storage bucket named "id_proofs" in the Supabase Dashboard
-- Make sure to set the bucket to "Public" so images can be viewed.
-- Then apply this policy to allow uploads:
CREATE POLICY "Allow public uploads to id_proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'id_proofs');

CREATE POLICY "Allow public reads from id_proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'id_proofs');
