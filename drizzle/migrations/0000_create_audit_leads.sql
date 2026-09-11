CREATE TABLE public.audit_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  recommended_tier TEXT,
  recommendation TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.audit_leads TO service_role;

ALTER TABLE public.audit_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to audit leads"
ON public.audit_leads
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
