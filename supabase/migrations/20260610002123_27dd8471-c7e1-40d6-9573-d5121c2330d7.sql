-- 1. Lock down invoices: clients should only READ their invoices.
-- Invoice creation/modification must happen server-side (service role), not by clients.
DROP POLICY IF EXISTS "Users can create their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

-- 2. Contact enquiries: make intent explicit. Inserts happen server-side via the
-- service role (which bypasses RLS). No client role should read or write this PII.
-- A restrictive deny-all policy documents that no anon/authenticated access is allowed.
DROP POLICY IF EXISTS "No client access to contact enquiries" ON public.contact_enquiries;
CREATE POLICY "No client access to contact enquiries"
  ON public.contact_enquiries
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- 3. Realtime authorization: require authentication to use Broadcast/Presence
-- channels. Prevents anonymous clients from subscribing to realtime topics.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can receive realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated users can send realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);