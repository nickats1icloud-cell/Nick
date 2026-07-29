-- Tighten INSERT policy to require from_user_id = auth.uid()
DROP POLICY "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications from themselves"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);