CREATE OR REPLACE FUNCTION create_booking_return_id(
  p_check_in_date DATE,
  p_check_out_date DATE,
  p_agreed_price NUMERIC,
  p_status TEXT
) RETURNS INT AS $$
DECLARE
  new_id INT;
BEGIN
  INSERT INTO public."Bookings" (check_in_date, check_out_date, agreed_price, status)
  VALUES (p_check_in_date, p_check_out_date, p_agreed_price, p_status)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
