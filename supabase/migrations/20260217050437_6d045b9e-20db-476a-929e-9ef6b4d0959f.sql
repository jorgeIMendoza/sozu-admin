
-- Trigger function to sync email confirmation from auth.users to usuarios table
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.usuarios
  SET email_confirmado = true, fecha_actualizacion = now()
  WHERE LOWER(email) = LOWER(NEW.email)
    AND email_confirmado = false;
  RETURN NEW;
END;
$$;

-- Fire when email_confirmed_at changes from NULL to a value
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_email_confirmation();
