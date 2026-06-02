-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  service_type TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Request submitted',
  current_step INTEGER NOT NULL DEFAULT 0,
  next_action TEXT,
  budget TEXT,
  timeline TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'team',
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_messages_user_id ON public.messages(user_id);

-- ============ PROJECT FILES ============
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own files"
ON public.project_files FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own files"
ON public.project_files FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
ON public.project_files FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
ON public.project_files FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_project_files_user_id ON public.project_files(user_id);

-- ============ CONSULTATIONS ============
CREATE TABLE public.consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consultations"
ON public.consultations FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own consultations"
ON public.consultations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consultations"
ON public.consultations FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consultations"
ON public.consultations FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_consultations_user_id ON public.consultations(user_id);

-- ============ CONTACT ENQUIRIES (public form) ============
CREATE TABLE public.contact_enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  client_type TEXT,
  service TEXT,
  description TEXT NOT NULL,
  budget TEXT,
  timeline TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No anon/authenticated grants: enquiries are written and read only via
-- trusted server code using the service role.
GRANT ALL ON public.contact_enquiries TO service_role;

ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;