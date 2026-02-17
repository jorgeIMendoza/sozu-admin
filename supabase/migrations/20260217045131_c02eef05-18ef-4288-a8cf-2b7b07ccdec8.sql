-- Fix: auth.uid() works inside SECURITY DEFINER, but let's use jwt() email directly
-- which is more reliable in this context
CREATE OR REPLACE FUNCTION public.mark_email_confirmed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from JWT claim directly (more reliable than querying auth.users)
  user_email := current_setting('request.jwt.claims', true)::json->>'email';
  
  IF user_email IS NOT NULL THEN
    UPDATE usuarios
    SET email_confirmado = true, fecha_actualizacion = now()
    WHERE LOWER(email) = LOWER(user_email)
      AND email_confirmado = false;
  END IF;
END;
$$;