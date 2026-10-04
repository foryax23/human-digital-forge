CREATE TABLE public.deep_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  credits integer NOT NULL DEFAULT 1 CHECK (credits >= 0 AND credits <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.deep_credits TO authenticated;
GRANT ALL ON public.deep_credits TO service_role;
ALTER TABLE public.deep_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own deep credits" ON public.deep_credits
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Atomically spend one deep check (a missing row is a free account with 1 check).
CREATE OR REPLACE FUNCTION public.deep_use_credit(_uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  INSERT INTO public.deep_credits(user_id) VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.deep_credits SET credits = credits - 1, updated_at = now()
    WHERE user_id = _uid AND credits > 0 RETURNING true INTO ok;
  RETURN coalesce(ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.deep_refund_credit(_uid uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.deep_credits SET credits = least(credits + 1, 1000), updated_at = now() WHERE user_id = _uid;
$$;

REVOKE ALL ON FUNCTION public.deep_use_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deep_refund_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deep_use_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.deep_refund_credit(uuid) TO service_role;