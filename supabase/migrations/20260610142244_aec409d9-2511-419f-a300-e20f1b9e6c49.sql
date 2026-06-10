CREATE TABLE public.subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscribers_email_key ON public.subscribers (email);
CREATE UNIQUE INDEX subscribers_user_id_key ON public.subscribers (user_id);

GRANT SELECT ON public.subscribers TO authenticated;
GRANT ALL ON public.subscribers TO service_role;

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
ON public.subscribers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_subscribers_updated_at
BEFORE UPDATE ON public.subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();