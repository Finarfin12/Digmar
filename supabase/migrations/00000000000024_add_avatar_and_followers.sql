-- Add avatar_url, account_name, and followers_count to social_accounts
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER;

-- Optional: update types for Supabase JS client
NOTIFY pgrst, 'reload schema';
