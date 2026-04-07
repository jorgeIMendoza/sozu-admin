
CREATE POLICY "Admins can insert notification config"
ON public.notificaciones_configuracion
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.auth_user_id = auth.uid()
      AND usuarios.rol_id = 1
      AND usuarios.activo = true
  )
);

CREATE POLICY "Admins can update notification config"
ON public.notificaciones_configuracion
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.auth_user_id = auth.uid()
      AND usuarios.rol_id = 1
      AND usuarios.activo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.auth_user_id = auth.uid()
      AND usuarios.rol_id = 1
      AND usuarios.activo = true
  )
);

CREATE POLICY "Admins can delete notification config"
ON public.notificaciones_configuracion
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE usuarios.auth_user_id = auth.uid()
      AND usuarios.rol_id = 1
      AND usuarios.activo = true
  )
);
