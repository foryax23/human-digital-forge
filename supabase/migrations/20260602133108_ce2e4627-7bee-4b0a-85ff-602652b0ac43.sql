-- Enable realtime change capture for the workspace tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.project_files REPLICA IDENTITY FULL;
ALTER TABLE public.consultations REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;