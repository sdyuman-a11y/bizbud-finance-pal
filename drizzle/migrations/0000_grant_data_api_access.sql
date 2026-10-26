GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.documents, public.invoices, public.holdings, public.profiles TO service_role;